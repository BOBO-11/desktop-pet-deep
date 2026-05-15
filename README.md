# Desktop Pet

一个从零搭建的 Electron + React + TypeScript + Vite 桌宠应用。

## 功能

- 透明、无边框、背景透明的桌面窗口
- 窗口大小固定为 240x240
- 默认置顶
- PNG 桌宠角色素材
- 鼠标左键拖拽移动窗口
- 状态机支持 idle、blink、happy、angry、sleep
- 每 5 到 12 秒随机眨眼
- 点击宠物切换到 happy，2 秒后恢复 idle
- 连续点击 5 次切换到 angry，3 秒后恢复 idle
- 30 秒无交互进入 sleep
- 鼠标移入角色时从 sleep 回到 idle
- 右键菜单包含“切换置顶”和“退出”

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
│  │  └─ usePetStateMachine.ts # 桌宠动画状态机
│  ├─ App.tsx          # 桌宠 UI、图片状态、拖拽交互
│  ├─ main.tsx         # React 入口
│  ├─ styles.css       # 透明页面和桌宠图片样式
│  └─ vite-env.d.ts    # Vite 与 preload API 类型声明
├─ index.html
├─ package.json
├─ tsconfig.json
├─ tsconfig.electron.json
└─ vite.config.ts
```

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
3. 等待 5 到 12 秒，应短暂进入 blink 状态。
4. 单击角色，应进入 happy 状态，2 秒后恢复 idle。
5. 连续快速点击 5 次，应进入 angry 状态，3 秒后恢复 idle。
6. 30 秒不点击、不拖拽、不右键，应进入 sleep 状态。
7. 鼠标移入角色，应从 sleep 回到 idle。
