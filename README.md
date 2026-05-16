# Desktop Pet

一个从零搭建的 Electron + React + TypeScript + Vite 桌面宠物应用。

## 功能

- 透明、无边框、背景透明的桌面窗口
- 窗口大小固定为 240x240
- 默认置顶，可通过右键菜单切换
- PNG 桌宠角色素材
- 鼠标左键拖拽移动窗口
- 状态机支持 idle、happy、angry、sleep、hungry、working
- 点击宠物切换到 happy，2 秒后恢复 idle 或 hungry
- 连续点击 5 次切换到 angry，3 秒后恢复 idle 或 hungry
- 10 分钟无交互后进入 sleep
- 鼠标移入角色时从 sleep 唤醒
- 右键菜单支持打工、喂食、切换置顶和退出
- 互动和打工可获得积分，喂食会消耗积分

## 项目结构

```text
desktop-pet
├─ electron
│  ├─ main.ts          # Electron 主进程：窗口、置顶、右键菜单、窗口移动
│  └─ preload.ts       # 安全暴露 IPC API 给 React
├─ public
│  ├─ pet              # 当前桌宠素材
│  └─ pet_backup       # 旧素材备份
├─ src
│  ├─ hooks
│  │  ├─ useHunger.ts
│  │  ├─ usePetStateMachine.ts
│  │  ├─ usePoints.ts
│  │  └─ useWork.ts
│  ├─ App.tsx          # 桌宠 UI、图片状态、拖拽交互
│  ├─ main.tsx         # React 入口
│  ├─ styles.css
│  ├─ styles
│  │  └─ pet.css
│  └─ vite-env.d.ts    # preload API 类型声明
├─ index.html
├─ package.json
├─ tsconfig.json
├─ tsconfig.electron.json
└─ vite.config.ts
```

更详细的逻辑架构、功能清单和后续功能扩展建议见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 安装依赖

```bash
npm install
```

## 开发启动

```bash
npm run start
```

这个命令会先编译 Electron 主进程，然后同时启动 Vite 开发服务器和 Electron 桌面窗口。

## 构建检查

```bash
npm run build
```

这个命令会检查 React TypeScript、打包 Vite 渲染进程，并编译 Electron 主进程。

## 状态机测试

1. 启动应用：`npm run start`
2. 默认应显示 idle 状态。
3. 单击角色，应进入 happy 状态，2 秒后恢复 idle。
4. 连续快速点击 5 次，应进入 angry 状态，3 秒后恢复 idle。
5. 10 分钟不点击、不拖拽、不右键，应进入 sleep 状态。
6. 鼠标移入角色，应从 sleep 回到 idle。
7. 当饥饿值低于阈值时，应进入 hungry 状态。
8. 右键选择打工，倒计时结束后应获得积分。
9. 右键选择喂食，积分足够时应恢复饥饿值并扣除积分。
