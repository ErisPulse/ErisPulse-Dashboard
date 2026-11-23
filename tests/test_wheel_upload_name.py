"""上传安装的 wheel 文件名/元数据一致性：暂存改名曾是安装失败的根因。

uv/pip 对裸路径 wheel 安装从**文件名**推包名并与内部 dist-info 严格比对，
文件名与元数据不符直接拒装（ep_upload_ 前缀事故）。这里锁死：元数据是唯一
事实源，暂存名不一致时改写成规范名；版本号同步 PEP 440 规范化——连字符
版本（2.12.1-dev.1）会把文件名拆出非法 build tag 段，pip 判非法 build、
uv 按 PEP 825 误判变体 wheel 找 variant.json，均拒装。
"""
import os
import re
import zipfile

from ErisPulse_Dashboard.Core.PipOps import PipOpsMixin


def make_wheel(path, dist_stem="erispulse_qvqchat-4.6.7", name="ErisPulse-QvQChat", version="4.6.7"):
    """构造最小可用 wheel（仅 dist-info/METADATA）。"""
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr(
            f"{dist_stem}.dist-info/METADATA",
            f"Metadata-Version: 2.1\nName: {name}\nVersion: {version}\n",
        )
    return path


def test_identity_reads_dist_info(tmp_path):
    wheel = make_wheel(tmp_path / "erispulse_qvqchat-4.6.7-py3-none-any.whl")
    assert PipOpsMixin._wheel_dist_identity(str(wheel)) == ("ErisPulse-QvQChat", "4.6.7")


def test_identity_handles_missing_and_broken(tmp_path):
    empty = tmp_path / "empty-1.0-py3-none-any.whl"
    with zipfile.ZipFile(empty, "w") as zf:
        zf.writestr("some_module/__init__.py", "")
    assert PipOpsMixin._wheel_dist_identity(str(empty)) == ("", "")
    broken = tmp_path / "broken-1.0-py3-none-any.whl"
    broken.write_bytes(b"not a zip")
    assert PipOpsMixin._wheel_dist_identity(str(broken)) == ("", "")


def test_resolve_dist_name_ignores_wrong_filename(tmp_path):
    """文件名被改（如 ep_upload_ 前缀）时按元数据返回真实发行名。"""
    wheel = make_wheel(tmp_path / "ep_upload_erispulse_qvqchat-4.6.7-py3-none-any.whl")
    assert PipOpsMixin._resolve_file_dist_name(
        str(wheel), "ep_upload_erispulse_qvqchat-4.6.7-py3-none-any.whl"
    ) == "erispulse-qvqchat"


def test_canonicalize_renames_mismatched_upload(tmp_path):
    """改过名上传的 wheel（qvqchat.whl）按元数据改写成规范文件名。"""
    wheel = make_wheel(tmp_path / "qvqchat.whl")
    new_path, new_stem, new_filename = PipOpsMixin()._canonicalize_wheel_name(
        str(wheel), "qvqchat", str(tmp_path)
    )
    assert new_filename == "ErisPulse_QvQChat-4.6.7-py3-none-any.whl"
    assert new_stem == "ErisPulse_QvQChat-4.6.7-py3-none-any"
    assert os.path.exists(new_path) and not wheel.exists()


def test_canonicalize_keeps_original_tags(tmp_path):
    """规范名不符但带平台 tag 的 wheel：改前两段、保留原 tags。"""
    stem = "wrong-9.9.9-cp311-cp311-win_amd64"
    wheel = make_wheel(tmp_path / (stem + ".whl"))
    _new_path, _new_stem, new_filename = PipOpsMixin()._canonicalize_wheel_name(
        str(wheel), stem, str(tmp_path)
    )
    assert new_filename == "ErisPulse_QvQChat-4.6.7-cp311-cp311-win_amd64.whl"


def test_canonicalize_noop_for_matching_name(tmp_path):
    wheel = make_wheel(tmp_path / "erispulse_qvqchat-4.6.7-py3-none-any.whl")
    stem = "erispulse_qvqchat-4.6.7-py3-none-any"
    new_path, new_stem, new_filename = PipOpsMixin()._canonicalize_wheel_name(
        str(wheel), stem, str(tmp_path)
    )
    assert (new_path, new_stem, new_filename) == (str(wheel), stem, stem + ".whl")


def test_canonicalize_normalizes_hyphenated_version(tmp_path):
    """版本段含连字符（2.12.1-dev.1）时改写为规范 2.12.1.dev1 并丢弃残段。"""
    wheel = make_wheel(
        tmp_path / "ErisPulse-2.12.1-dev.1-py3-none-any.whl",
        dist_stem="ErisPulse-2.12.1-dev.1", name="ErisPulse", version="2.12.1-dev.1",
    )
    _path, new_stem, new_filename = PipOpsMixin()._canonicalize_wheel_name(
        str(wheel), "ErisPulse-2.12.1-dev.1-py3-none-any", str(tmp_path)
    )
    assert new_stem == "ErisPulse-2.12.1.dev1-py3-none-any"
    assert new_filename == "ErisPulse-2.12.1.dev1-py3-none-any.whl"


def test_canonicalize_noop_when_filename_version_is_normalized(tmp_path):
    """METADATA 版本未规范化（2.12.1-dev.1）但文件名已是规范 .dev1：不再改写。"""
    wheel = make_wheel(
        tmp_path / "ErisPulse-2.12.1.dev1-py3-none-any.whl",
        dist_stem="ErisPulse-2.12.1.dev1", name="ErisPulse", version="2.12.1-dev.1",
    )
    stem = "ErisPulse-2.12.1.dev1-py3-none-any"
    result = PipOpsMixin()._canonicalize_wheel_name(str(wheel), stem, str(tmp_path))
    assert result == (str(wheel), stem, stem + ".whl")


def test_normalize_pep440_version_segments():
    f = PipOpsMixin._normalize_pep440_version
    assert f("2.12.1-dev.1") == "2.12.1.dev1"
    assert f("1.0.0-RC1") == "1.0.0rc1"
    assert f("1.0_preview2") == "1.0rc2"
    assert f("1.0-rev2") == "1.0.post2"
    assert f("4.6.7") == "4.6.7"


def test_canonicalize_survives_broken_wheel(tmp_path):
    broken = tmp_path / "broken.whl"
    broken.write_bytes(b"not a zip")
    new_path, _new_stem, new_filename = PipOpsMixin()._canonicalize_wheel_name(
        str(broken), "broken", str(tmp_path)
    )
    assert new_path == str(broken) and new_filename == "broken.whl"


def test_canonicalized_name_is_install_safe(tmp_path):
    """改写后的文件名必须满足 uv/pip 的 wheel 名规范：首段归一化即元数据名。"""
    wheel = make_wheel(tmp_path / "totally_wrong.whl")
    new_path, _stem, new_filename = PipOpsMixin()._canonicalize_wheel_name(
        str(wheel), "totally_wrong", str(tmp_path)
    )
    first_segment = os.path.basename(new_filename).split("-")[0]
    normalized = first_segment.lower().replace("_", "-")
    name, _version = PipOpsMixin._wheel_dist_identity(new_path)
    assert normalized == name.lower().replace("_", "-")
    assert re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", first_segment)
