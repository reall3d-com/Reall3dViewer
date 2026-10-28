// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
let i = 1;

/** 添加相机飞行轨迹点 */
export const AddFlyPosition = i++;
/** 添加标注弱引用缓存 */
export const AddMarkToWeakRef = i++;
/** 设定相机视点 */
export const CameraSetLookAt = i++;
/** 取消当前正在进行的标注 */
export const CancelCurrentMark = i++;
/** 是否可以更新纹理 */
export const CanUpdateTexture = i++;
/** 截图 */
export const CaptureScreenshot = i++;
/** 检查是否确实需要渲染 */
export const CheckViewerUpdateRow = i++;
/** 清空相机飞行轨迹点 */
export const ClearFlyPosition = i++;
/** 清除标注选点 */
export const ClearMarkPoint = i++;
/** 销毁 */
export const CommonUtilsDispose = i++;

/** 渲染帧率 */
export const ComputeFps = i++;
/** 计算多个平面的面积 */
export const ComputePlansArea = i++;
/** 计算平面中心点 */
export const ComputePlansCenter = i++;
/** 计算三角面的面积 */
export const ComputePoint3Area = i++;
/** 计算纹理宽高 */
export const ComputeTextureWidthHeight = i++;
/** 计算纹理宽高深 */
export const ComputeTextureWidthHeightDepth = i++;
/** 控制平面显示控制 */
export const ControlPlaneSwitchVisible = i++;
/** 控制平面刷新 */
export const ControlPlaneUpdate = i++;
/** 更新相机视点改成飞翔模式 */
export const ControlsSetFlyCameraMode = i++;
/** 控制器更新 */
export const ControlsUpdate = i++;

/** 控制器更新旋转轴 */
export const ControlsUpdateRotateAxis = i++;
/** 默认渲染帧率计数器更新 */
export const CountFpsDefault = i++;
/** 真实渲染帧率计数器更新 */
export const CountFpsReal = i++;
/** Splat几何体 */
export const CreateSplatGeometry = i++;
/** Splat材质 */
export const CreateSplatMaterial = i++;
/** Splat网格 */
export const CreateSplatMesh = i++;
/** Splat全局变量 */
export const CreateSplatUniforms = i++;
/** 解码 base64 */
export const DecodeBase64 = i++;
/** 删除标注弱引用缓存 */
export const DeleteMarkWeakRef = i++;
/** 禁止背景音乐 */
export const DisableBgAudio = i++;

/** 编码 base64 */
export const EncodeBase64 = i++;
/** 销毁 */
export const EventListenerDispose = i++;
/** 禁止相机飞行控制 */
export const FlyDisable = i++;
/** 允许相机飞行控制 */
export const FlyEnable = i++;
/** 相机飞行控制 */
export const Flying = i++;
/** 飞行继续 */
export const FlyingContinue = i++;
/** 飞行暂停 */
export const FlyingPause = i++;
/** 飞行播放 */
export const FlyingPlay = i++;
/** 相机飞行控制(仅一次) */
export const FlyOnce = i++;
/** 保存相机飞行轨迹点 */
export const FlySavePositions = i++;

/** 聚焦包围盒中心点 */
export const FocusAabbCenter = i++;
/** 焦点标记自动消失 */
export const FocusMarkerAutoDisappear = i++;
/** 焦点标记材质设定透明度 */
export const FocusMarkerSetOpacity = i++;
/** 刷新焦点标记网格 */
export const FocusMarkerUpdate = i++;
/** 取模型包围盒中心点 */
export const GetAabbCenter = i++;
/** 取背景音乐对象 */
export const GetBgAudio = i++;
/** 取当前缓存的水印文字 */
export const GetCachedWaterMark = i++;
/** 取得相关对象 */
export const GetCamera = i++;
/** 取相机方向 */
export const GetCameraDirection = i++;
/** 取相机Fov */
export const GetCameraFov = i++;

/** 取得当前相机参数信息 */
export const GetCameraInfo = i++;
/** 取相机视点 */
export const GetCameraLookAt = i++;
/** 取相机上向量 */
export const GetCameraLookUp = i++;
/** 取相机位置 */
export const GetCameraPosition = i++;
/** 取得相关对象 */
export const GetCanvas = i++;
/** 画布尺寸 */
export const GetCanvasSize = i++;
/** 控制平面 */
export const GetControlPlane = i++;
/** 取得相关对象 */
export const GetControls = i++;
/** 取CSS2DRenderer */
export const GetCSS2DRenderer = i++;
/** 取CSS3DRenderer */
export const GetCSS3DRenderer = i++;

/** 当前以多少球谐系数级别在显示 */
export const GetCurrentDisplayShDegree = i++;
/** 取层级纹理 */
export const GetDataArrayTexture = i++;
/** 取相机飞行轨迹（数组形式，用于存盘） */
export const GetFlyPositionArray = i++;
/** 取相机飞行轨迹 */
export const GetFlyPositions = i++;
/** 取相机飞行视点轨迹（数组形式，用于存盘） */
export const GetFlyTargetArray = i++;
/** 取焦点标记材质 */
export const GetFocusMarkerMaterial = i++;
/** 默认渲染帧率 */
export const GetFpsDefault = i++;
/** 真实渲染帧率 */
export const GetFpsReal = i++;
/** 取高斯文本 */
export const GetGaussianText = i++;
/** 取大场景活动点 */
export const GetLodActiveXyz = i++;

/** 取LOD数据信息 */
export const GetLodDataInfo = i++;
/** 模型数据的球谐系数级别 */
export const GetLodModelShDegree = i++;
/** 按名称取标注数据 */
export const GetMarkDataByName = i++;
/** 从弱引用缓存取标注对象 */
export const GetMarkFromWeakRef = i++;
/** 取所有标注 */
export const GetMarkList = i++;
/** 取标注包裹元素 */
export const GetMarkWarpElement = i++;
/** 当前时点限制渲染的的高斯点数(包含了附加的动态文字水印数) */
export const GetMaxRenderCount = i++;
/** 取内存中的元数据 */
export const GetMeta = i++;
/** 取元数据中配置的矩阵 */
export const GetMetaMatrix = i++;
/** 模型数据的球谐系数级别 */
export const GetModelShDegree = i++;

/** 取得渲染器选项 */
export const GetOptions = i++;
/** 取玩家 */
export const GetPlayer = i++;
/** 取渲染器 */
export const GetRenderer = i++;
/** 取设定的渲染质量级别(1~9) */
export const GetRenderQualityLevel = i++;
/** 取场景 */
export const GetScene = i++;
/** 取ShaderMaterial */
export const GetShaderMaterial = i++;
/** 球谐系数纹理高度 */
export const GetShTexheight = i++;
/** 取设定的排序类型 */
export const GetSortType = i++;
/** 取得相关对象 */
export const GetSortWorker = i++;
/** 取活动点数据 */
export const GetSplatActivePoints = i++;

/** 取Splat几何体 */
export const GetSplatGeometry = i++;
/** 取Splat材质 */
export const GetSplatMaterial = i++;
/** 取SplatMesh实例 */
export const GetSplatMesh = i++;
/** 着色器宏定义 */
export const GetSplatShaderDefines = i++;
/** 取SplatTiles */
export const GetSplatTiles = i++;
/** 取视图投影矩阵 */
export const GetViewProjectionMatrix = i++;
/** 取视图投影矩阵数组 */
export const GetViewProjectionMatrixArray = i++;
/** 提交元数据到服务器 */
export const HttpPostMetaData = i++;
/** 取文本高斯数据 */
export const HttpQueryGaussianText = i++;
/** 增加相机Fov */
export const IncreaseCameraFov = i++;

/** 渲染信息 */
export const Information = i++;
/** 物理相交检测 */
export const IntersectsPhysicsObjects = i++;
/** 是否大场景模式 */
export const IsBigSceneMode = i++;
/** 是否相机视角发生变化需要重新加载数据 */
export const IsCameraChangedNeedLoadData = i++;
/** 是否相机视角发生变化需要渲染 */
export const IsCameraChangedNeedUpdate = i++;
/** 是否看见 */
export const IsCameraLookAtPoint = i++;
/** 控制平面是否可见 */
export const IsControlPlaneVisible = i++;
/** 是否调试模式 */
export const IsDebugMode = i++;
/** 是否默认渲染管线 */
export const IsDefaultPipeline = i++;
/** 是否加载中（小场景适用） */
export const IsFetching = i++;

/** 是否飞行模式 */
export const IsFlyMode = i++;
/** 是否下载中 */
export const IsLodFetching = i++;
/** 是否玩家模式 */
export const IsPlayerMode = i++;
/** 是否第一人称玩家模式 */
export const IsPlayerMode1 = i++;
/** 是否第三人称玩家模式 */
export const IsPlayerMode3 = i++;
/** 是否点云模式 */
export const IsPointcloudMode = i++;
/** 是否在前方 */
export const IsPointInFront = i++;
/** 数据是否已下载结束并准备就绪（小场景适用） */
export const IsSmallSceneRenderDataReady = i++;
/** 小场景是否已渲染就绪 */
export const IsSmallSceneShowDone = i++;
/** SplatMesh是否已创建 */
export const IsSplatMeshCreated = i++;

/** 是否完成初次渲染 */
export const IsSplatShowDone = i++;
/** 检查执行键盘按键动作处理 */
export const KeyActionCheckAndExecute = i++;
/** 加载音频遮罩 */
export const LoadCircularAudioMask = i++;
/** 加载模型开始 */
export const LoaderModelStart = i++;
/** 加载小场景元数据(相机初始化，标注待激活显示) */
export const LoadSmallSceneMetaData = i++;
/** 大场景添加LOD元数据 */
export const LodDownloadAddLodMeta = i++;
/** 销毁 */
export const LodDownloadManagerDispose = i++;
/** 创建地图相机 */
export const MapCreateCamera = i++;
/** 创建地图控制器 */
export const MapCreateControls = i++;
/** 创建光源 */
export const MapCreateDirLight = i++;

/** 创建地图渲染器 */
export const MapCreateRenderer = i++;
/** 创建地图场景 */
export const MapCreateScene = i++;
/** 飞向目标 */
export const MapFlyToTarget = i++;
/** 取一个活动的splatMesh实例(仅用于地图单个高斯模型调整) */
export const MapGetSplatMesh = i++;
/** 遍历并清空销毁场景中的所有对象 */
export const MapSceneTraverseDispose = i++;
/** 对多个SplatMesh实例的渲染顺序进行排序 */
export const MapSortSplatMeshRenderOrder = i++;
/** 按X轴平移 */
export const MapSplatMeshMoveX = i++;
/** 按Y轴平移 */
export const MapSplatMeshMoveY = i++;
/** 按Z轴平移 */
export const MapSplatMeshMoveZ = i++;
/** 按X轴旋转 */
export const MapSplatMeshRotateX = i++;

/** 按Y轴旋转 */
export const MapSplatMeshRotateY = i++;
/** 按Z轴旋转 */
export const MapSplatMeshRotateZ = i++;
/** 保存模型矩阵 */
export const MapSplatMeshSaveModelMatrix = i++;
/** 缩放 */
export const MapSplatMeshScale = i++;
/** 设定位置 */
export const MapSplatMeshSetPosition = i++;
/** 切换显示隐藏 */
export const MapSplatMeshShowHide = i++;
/** 标注面积 */
export const MarkArea = i++;
/** 标注距离 */
export const MarkDistance = i++;
/** 标注结束 */
export const MarkFinish = i++;
/** 标注线 */
export const MarkLine = i++;

/** 标注面 */
export const MarkPlan = i++;
/** 标注点 */
export const MarkPoint = i++;
/** 标注更新可见状态 */
export const MarkUpdateVisible = i++;
/** 标注数据删除 */
export const MetaMarkRemoveData = i++;
/** 标注数据保存 */
export const MetaMarkSaveData = i++;
/** 保存小场景相机信息 */
export const MetaSaveSmallSceneCameraInfo = i++;
/** 保存水印 */
export const MetaSaveWatermark = i++;
/** 移动玩家(前后左右) */
export const MovePlayer = i++;
/** 移动玩家(按角度) */
export const MovePlayerByAngle = i++;
/** 移动玩家(到目标点) */
export const MovePlayerToTarget = i++;

/** 通知渲染器需要刷新 */
export const NotifyViewerNeedUpdate = i++;
/** 通知回传 */
export const NotifyWkA01BackSplatBuffer = i++;
/** 通知回传 */
export const NotifyWkA01BackXyz = i++;
/** 通知回传 */
export const NotifyWkA01BackXyzIndex = i++;
/** 请求层级 */
export const NotifyWkA01CalcTargetLayer = i++;
/** 通知销毁 */
export const NotifyWkA01ReleaseSplatFile = i++;
/** 通知设定 */
export const NotifyWkA01SetTextureSize = i++;
/** 通知就绪 */
export const NotifyWkA09DblTextureReady = i++;
/** 通知就绪 */
export const NotifyWkA09SglTextureReady = i++;
/** 排序 */
export const NotifyWkA09Sort = i++;

/** 全量模式通知更新排序用数据 */
export const NotifyWkA09SortPart = i++;
/** 单纯的鼠标移动 */
export const OnCanvasMouseMove = i++;
/** 模型文件下载中 */
export const OnFetching = i++;
/** 模型文件下载开始 */
export const OnFetchStart = i++;
/** 模型文件下载结束 */
export const OnFetchStop = i++;
/** 按元数据初始化标记 */
export const OnInitMarks = i++;
/** 渲染obj模型 */
export const OnLoadAndRenderObj = i++;
/** 渲染ply点云模型 */
export const OnLoadAndRenderPointCloudPly = i++;
/** 元数据加载 */
export const OnMetaDataLoaded = i++;
/** 更新质量级别 */
export const OnQualityLevelChanged = i++;

/** 设定飞行时长 */
export const OnSetFlyDuration = i++;
/** 设定相机飞行轨迹 */
export const OnSetFlyPositions = i++;
/** 设定相机飞行视点轨迹 */
export const OnSetFlyTargets = i++;
/** 设定水印文字 */
export const OnSetWaterMark = i++;
/** 小场景显示完成 */
export const OnSmallSceneShowDone = i++;
/** LOD全部上传完成 */
export const OnSplatLodFullUploaded = i++;
/** Lod场景首次加载显示 */
export const OnStartLodShown = i++;
/** 数据上传就绪的渲染数（小场景适用） */
export const OnTextureReadySplatCount = i++;
/** 上传纹理排序已完成 */
export const OnUploadDblIndexDone = i++;
/** 渲染后处理 */
export const OnViewerAfterUpdate = i++;

/** 渲染前处理 */
export const OnViewerBeforeUpdate = i++;
/** 渲染器销毁 */
export const OnViewerDispose = i++;
/** 渲染处理 */
export const OnViewerUpdate = i++;
/** 添加物理Mesh */
export const PhysicsAddMesh = i++;
/** 添加物理glb静态刚体 */
export const PhysicsAddStaticCollisionGlb = i++;
/** 添加动态物理Mesh */
export const PhysicsAdDynamicMesh = i++;
/** 物理扫球调整相机 */
export const PhysicsAdjustCameraByCastShape = i++;
/** 添加静态物理Mesh */
export const PhysicsAdStaticMesh = i++;
/** 激活物理渲染调试 */
export const PhysicsEnableDebug = i++;
/** 取物理环境刚体 */
export const PhysicsGetEnvCollision = i++;

/** 取目标点相交检测用对象数组（虚拟地面及静态刚体） */
export const PhysicsGetGroundCollision = i++;
/** 物理虚拟角色控制器 */
export const PhysicsInitCharacterController = i++;
/** 物理移动虚拟角色 */
export const PhysicsMovePlayer = i++;
/** 删除物理Mesh */
export const PhysicsRemoveMesh = i++;
/** 播放背景音乐 */
export const PlaytBgAudio = i++;
/** 打印信息（开发调试用） */
export const PrintInfo = i++;
/** 回放缓存 */
export const PushCacheXyzIndex = i++;
/** 射线与点的距离 */
export const RaycasterRayDistanceToPoint = i++;
/** 射线相交标注 */
export const RaycasterRayIntersectMarks = i++;
/** 射线拾取点 */
export const RaycasterRayIntersectPoints = i++;

/** 按数据重新计算多个平面的面积 */
export const ReComputePlansArea = i++;
/** 渲染CSS2D3D对象 */
export const RenderCSS2D3D = i++;
/** 渲染小地图 */
export const RenderMinimap = i++;
/** 视线轴旋转 */
export const RotateAt = i++;
/** 视线轴左旋 */
export const RotateLeft = i++;
/** 视线轴右旋 */
export const RotateRight = i++;
/** 帧率循环调用 */
export const RunLoopByFrame = i++;
/** 定时循环调用 */
export const RunLoopByTime = i++;
/** 标注选点 */
export const SelectMarkPoint = i++;
/** 调整视点为拾取点 */
export const SelectPointAndLookAt = i++;

/** 背景音乐音量渐进调小 */
export const SetBgAudioVolumeDown = i++;
/** 背景音乐音量渐进调大 */
export const SetBgAudioVolumeUp = i++;
/** 设定鼠标样式 */
export const SetCursor = i++;
/** 设定高斯文本 */
export const SetGaussianText = i++;
/** 纹理更新时间 */
export const SetTexdataChangeLastTime = i++;
/** 设定渲染器外部接口 */
export const SetViewerApi = i++;
/** 显示虚拟摇杆 */
export const ShowJoystick = i++;
/** 下载解析高斯数据 */
export const SplatDataFetcher = i++;
/** 添加模型 */
export const SplatDataManagerAddModel = i++;
/** 销毁 */
export const SplatDataManagerDispose = i++;

/** Splat几何体销毁 */
export const SplatGeometryDispose = i++;
/** Splat材质销毁 */
export const SplatMaterialDispose = i++;
/** 小场景渐进加载（圆圈扩大） */
export const SplatMeshCycleZoom = i++;
/** 销毁 */
export const SplatMeshDispose = i++;
/** 切换显示模式（通常仅小场景使用） */
export const SplatMeshSwitchDisplayMode = i++;
/** 更新包围盒数据 */
export const SplatSetBoundBoxVisible = i++;
/** 渲染器设定Splat点云模式 */
export const SplatSetPointcloudMode = i++;
/** 渲染器切换Splat显示模式 */
export const SplatSwitchDisplayMode = i++;
/** 大场景下载LOD数据 */
export const SplatTexdataManagerAddSplatLod = i++;
/** 数据是否有变化（大场景用） */
export const SplatTexdataManagerDataChanged = i++;

/** Splat更新活动标记 */
export const SplatUpdateActiveFlagValue = i++;
/** Splat更新场景模式 */
export const SplatUpdateBigSceneMode = i++;
/** 更新包围盒数据 */
export const SplatUpdateBoundBox = i++;
/** Splat更新光圈半径 */
export const SplatUpdateCurrentLightRadius = i++;
/** Splat更新可见半径 */
export const SplatUpdateCurrentVisibleRadius = i++;
/** Splat更新双缓冲纹理 */
export const SplatUpdateDblTexture = i++;
/** Splat更新调试效果 */
export const SplatUpdateDebugEffect = i++;
/** Splat更新标记 */
export const SplatUpdateFlagValue = i++;
/** Splat更新焦距 */
export const SplatUpdateFocal = i++;
/** Splat更新亮度系数 */
export const SplatUpdateLightFactor = i++;

/** Splat更新标记点 */
export const SplatUpdateMarkPoint = i++;
/** 更新包围球半径 */
export const SplatUpdateMaxRadius = i++;
/** 更新最低可渲染透明度(0~255) */
export const SplatUpdateMinAlpha = i++;
/** 更新最小最大像素直径限制 */
export const SplatUpdateMinMaxPixelDiameter = i++;
/** 小场景粒子效果加载模式（0，1，2） */
export const SplatUpdateParticleMode = i++;
/** Splat更新动作时间 */
export const SplatUpdatePerformanceAct = i++;
/** Splat更新系统时间 */
export const SplatUpdatePerformanceNow = i++;
/** Splat更新点云模式 */
export const SplatUpdatePointMode = i++;
/** Splat更新纹理 */
export const SplatUpdateSglTexture = i++;
/** Splat更新球谐系数纹理(1,2级) */
export const SplatUpdateSh12Texture = i++;

/** Splat更新球谐系数纹理(3级) */
export const SplatUpdateSh3Texture = i++;
/** Splat更新球谐系数级别 */
export const SplatUpdateShDegree = i++;
/** Splat更新水印显示与否 */
export const SplatUpdateShowWaterMark = i++;
/** Splat更新调色板纹理就绪状态 */
export const SplatUpdateShPalettesReady = i++;
/** Splat更新调色板纹理 */
export const SplatUpdateShPalettesTexture = i++;
/** Splat更新索引缓冲数据 */
export const SplatUpdateSplatIndex = i++;
/** Splat更新中心高点 */
export const SplatUpdateTopY = i++;
/** Splat更新特效类型 */
export const SplatUpdateTransitionEffect = i++;
/** 大场景是否使用LOD */
export const SplatUpdateUseLod = i++;
/** 更新是否使用近似计算替代exp的标记 */
export const SplatUpdateUseSimilarExp = i++;

/** Splat更新使用中索引 */
export const SplatUpdateUsingIndex = i++;
/** Splat更新视口 */
export const SplatUpdateViewport = i++;
/** 更新大场景缓存纹理 */
export const SplatUploadTextureGpuCache = i++;
/** 开始自动旋转 */
export const StartAutoRotate = i++;
/** 停止自动旋转 */
export const StopAutoRotate = i++;
/** 停止背景音乐 */
export const StopBgAudio = i++;
/** 待下载 */
export const TodoDownloadLod = i++;
/** 遍历销毁并清空Object3D的子对象 */
export const TraverseDisposeAndClear = i++;
/** 触发小场景加载数据 */
export const TriggerLoadSmallSceneData = i++;
/** 触发刷新 */
export const TriggerWkA01Refresh = i++;

/** 相机飞行控制 */
export const TweenFly = i++;
/** 禁止相机飞行控制 */
export const TweenFlyDisable = i++;
/** 允许相机飞行控制 */
export const TweenFlyEnable = i++;
/** 相机飞行控制(仅一次) */
export const TweenFlyOnce = i++;
/** 按米比例尺更新全部标注 */
export const UpdateAllMarkByMeterScale = i++;
/** 更新加载状态（无进度条） */
export const UpdateFetchStatus = i++;
/** 更新提示目标状态 */
export const UpdateIndicatorTargetStatus = i++;
/** 按数据更新指定名称的标注 */
export const UpdateMarkByName = i++;
/** 更新渲染质量级别 */
export const UpdateQualityLevel = i++;
/** 更新排序类型 */
export const UpdateSortType = i++;

/** 更新虚拟地面位置 */
export const UpdateVirtualGroundPosition = i++;
/** 上传纹理 */
export const UploadSplatTexture = i++;
/** 转字符串 */
export const Vector3ToString = i++;
/** 渲染器检查是否需要刷新 */
export const ViewerCheckNeedUpdate = i++;
/** 渲染器销毁 */
export const ViewerDispose = i++;
/** 通知渲染器需要刷新 */
export const ViewerNeedUpdate = i++;
/** 更新渲染器选项的点云模式 */
export const ViewerSetPointcloudMode = i++;
/** 销毁 */
export const ViewerUtilsDispose = i++;
/** 销毁 */
export const WorkerDispose = i++;
/** 更新Worker相关参数 */
export const WorkerUpdateParams = i++;
