"""ErisPulse Dashboard 核心包。

原单文件 Core.py 按职责拆分为 Mixin 模块，由 Main 组合全部 Mixin，
对外行为与拆分前完全一致。
"""

from ErisPulse.Core.Bases import BaseModule

from .Helpers import _CoreHelpers, VIEW_LANG_KEY_TO_I18N, _VIEW_I18N_LOCK
from .Base import MainBase
from .Views import ViewsMixin
from .Commands import CommandsMixin
from .EventLog import EventLogMixin
from .PipOps import PipOpsMixin
from .ModulesOps import ModulesOpsMixin
from .Status import StatusMixin
from .Routes import RoutesMixin
from .ApiAdapters import ApiAdaptersMixin
from .ApiModules import ApiModulesMixin
from .ApiDashboard import ApiDashboardMixin
from .ApiStore import ApiStoreMixin
from .ApiBuilder import ApiBuilderMixin
from .ApiFramework import ApiFrameworkMixin
from .ApiObservability import ApiObservabilityMixin
from .ApiFiles import ApiFilesMixin
from .ApiScope import ApiScopeMixin
from .ApiCluster import ApiClusterMixin


class Main(
    MainBase,
    ViewsMixin,
    CommandsMixin,
    EventLogMixin,
    PipOpsMixin,
    ModulesOpsMixin,
    StatusMixin,
    RoutesMixin,
    ApiAdaptersMixin,
    ApiModulesMixin,
    ApiDashboardMixin,
    ApiStoreMixin,
    ApiBuilderMixin,
    ApiFrameworkMixin,
    ApiObservabilityMixin,
    ApiFilesMixin,
    ApiScopeMixin,
    ApiClusterMixin,
    BaseModule,
):
    """
    ErisPulse Dashboard 主模块。

    由 Core/ 子包内按职责拆分的 Mixin 组合而成：
    生命周期与令牌（MainBase）、视图注册（ViewsMixin）、命令中间件（CommandsMixin）、
    事件/日志/审计（EventLogMixin）、pip 运行器（PipOpsMixin）、模块操作（ModulesOpsMixin）、
    系统状态（StatusMixin）、路由注册（RoutesMixin）及各 API 域（Api*Mixin）。
    """


__all__ = [
    "Main",
    "MainBase",
    "_CoreHelpers",
    "VIEW_LANG_KEY_TO_I18N",
    "_VIEW_I18N_LOCK",
]
