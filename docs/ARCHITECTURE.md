# 项目逻辑架构

这个项目是一个 Electron 桌面宠物应用，整体分为三层：

1. Electron 主进程：负责桌面窗口、右键菜单、置顶状态、窗口移动和退出。
2. Preload IPC 桥：把主进程能力以安全 API 暴露给 React。
3. React 渲染进程：负责宠物状态、积分、饥饿值、打工倒计时、气泡和 UI 动画。

## 当前功能点

- 桌面窗口
  - 透明无边框窗口
  - 固定 240x240
  - 默认置顶
  - 可切换置顶
  - 跳过任务栏
  - 限制拖拽范围在当前屏幕工作区内

- 宠物状态
  - `idle`：默认状态
  - `happy`：点击后短暂开心
  - `angry`：连续点击过多后生气
  - `sleep`：长时间无交互后睡觉
  - `hungry`：饥饿值过低
  - `working`：打工倒计时中

- 饥饿系统
  - 饥饿值持久化到 `localStorage`
  - 每分钟自动下降
  - 关闭应用期间按离线时间结算
  - 喂食恢复饥饿值

- 积分系统
  - 点击/唤醒等互动可获得积分
  - 互动积分有冷却、每分钟上限、每日上限
  - 打工完成可获得积分
  - 打工积分有每日上限
  - 积分持久化到 `localStorage`

- 打工系统
  - 右键菜单选择打工时长
  - 打工期间进入 `working`
  - 支持关闭应用后恢复倒计时
  - 倒计时结束后发放奖励

- 喂食系统
  - 右键菜单选择食物
  - 积分足够时扣积分并恢复饥饿值
  - 积分不足时显示气泡提示

- 表现层
  - 不同状态映射不同 PNG
  - 状态切换有淡入淡出
  - 不同状态有对应 CSS 动画
  - 气泡文案随机出现
  - 积分增加时显示浮动文字

## 目录职责

```text
electron/
  main.ts          Electron 主进程入口，负责窗口和 IPC handler
  menuConfig.ts    右键菜单数据，例如打工项和食物项
  preload.ts       安全暴露 window.desktopPet API

src/
  App.tsx          渲染层组合入口，只负责组装 hooks 和 UI 事件
  config/          可调整的规则和资源映射
  data/            静态内容，例如随机对话
  domain/          业务类型定义
  hooks/           业务状态逻辑
  styles/          宠物动画和样式
  utils/           无业务副作用的通用工具
```

## 关键数据流

### 右键打工

1. 用户右键宠物。
2. React 调用 `window.desktopPet.showContextMenu()`。
3. Electron 展示菜单。
4. 用户选择打工项。
5. Electron 发送 `pet:start-work`。
6. React 的 `useWork` 启动倒计时。
7. 状态机进入 `working`。
8. 倒计时结束后 `usePoints.addPoints()` 发放奖励。

### 右键喂食

1. 用户右键宠物。
2. Electron 展示食物菜单。
3. 用户选择食物。
4. Electron 发送 `pet:feed`。
5. React 判断积分是否足够。
6. 积分足够：扣积分，恢复饥饿值。
7. 积分不足：显示气泡提示。

### 普通互动

1. 用户点击或唤醒宠物。
2. 状态机处理状态切换。
3. `usePoints.tryEarnPoints()` 根据冷却和上限判断是否奖励。
4. 若获得积分，UI 显示浮动积分文字。

## 后续功能建议

- 成长系统
  - 等级、经验值、亲密度
  - 建议新增 `useProgression.ts`
  - 规则放入 `src/config/progressionRules.ts`

- 商店系统
  - 解锁皮肤、表情、背景、小道具
  - 建议新增 `src/features/shop/`
  - 商品配置独立成 `shopItems.ts`

- 任务系统
  - 每日任务、成就、连续登录
  - 建议新增 `useTasks.ts`
  - 任务定义用配置表，不要写死在组件里

- 多角色/多皮肤
  - 多套素材、多套对话、多套状态图
  - 建议把 `PET_IMAGES` 扩展为按角色 ID 索引

- 设置面板
  - 音效开关、透明度、窗口大小、置顶、自动睡眠时间
  - 建议新增 `useSettings.ts`
  - 设置持久化独立存储，不混入积分/饥饿逻辑

- 音效系统
  - 点击、喂食、打工完成、睡觉音效
  - 建议新增 `src/services/audio.ts`
  - 由状态变化或事件触发，不直接塞进 App

- 通知系统
  - 打工完成、饥饿提醒、每日上限提示
  - 建议在 Electron 主进程新增通知服务
  - 渲染进程只发出业务事件

## 后续开发原则

- 新增数值规则，优先放 `src/config/`。
- 新增业务状态，优先新增或扩展 `src/hooks/`。
- 新增纯工具函数，放 `src/utils/`。
- 新增跨模块类型，放 `src/domain/`。
- App 只做组合，不直接写复杂业务判断。
- Electron 菜单项只改 `electron/menuConfig.ts`。
- IPC payload 要在 preload 类型、主进程发送处、渲染进程监听处保持一致。
