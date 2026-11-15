# Readest 划词 AI 提问 + 官方 AI 解锁版 (Android APK 专属云端打包指南)

本改造包为开源电子书阅读器 [Readest](https://github.com/readest/readest) 同时集成了两大核心改造，并配置好了**全自动签名打包 Android APK 的 GitHub Actions 工作流**：

1. **新增 [Anx Reader](https://github.com/Anxcye/anx-reader) 风格「划词选中即问 AI」悬浮面板**：
   - 在阅读器选中任意中文或外文段落时，浮动工具栏（`AnnotationPopup.tsx`）新增 **「✨ 问 AI」** 按钮。
   - 内置 `深度解析`、`提炼要点`、`语境精译`、`背景考据`、`批判思考` 5 个快捷胶囊，支持**多轮自由追问**、**DeepSeek R1 思维链折叠**以及**一键将 AI 回答存入批注笔记**。
2. **解锁 [Readest 官方内置 AI 功能](https://readest.com/docs/translate) 的付费限制**：
   - 自动注入脚本 `apply-ai-feature.mjs` 会在编译时扫描并解除 `Custom Translators`（自定义 OpenAI/DeepSeek/Gemini 翻译）和 `Context Dictionary`（AI 语境词典）的 Plus/Pro/Full Customization 权限锁，让你无需订阅即可在 `Settings → Language` 中自由配置第三方大模型。
3. **全自动 Android APK V2/V3 签名与 Releases 发布**：
   - 官方默认未配置签名密钥时生成的 APK 无法直接安装到手机。本包内置的 `.github/workflows/build-android-ai-apk.yml` 会在云端自动生成签名证书、完成 `zipalign` 对齐与 `apksigner` 签名，并直接将 `Readest-AI-Unlocked-arm64.apk` 发布到你仓库的 **Releases** 页面。

---

## 一、压缩包文件清单

```text
readest-anx-ai-selection-mod/
├── README_AI_MOD.md                                              # 本说明文档
├── apply-ai-feature.mjs                                          # 编译前自动执行的「组件注入 + 官方付费锁解除」脚本
├── .github/workflows/build-android-ai-apk.yml                    # Android APK 专属自动编译、自动签名与 Release 发布工作流
└── apps/readest-app/src/
    ├── store/aiAskStore.ts                                       # Zustand 状态与多服务商/Prompt 持久化 Store
    ├── services/ai/selectionAskClient.ts                         # 流式 OpenAI/DeepSeek/Gemini/Ollama 客户端
    └── app/reader/components/annotator/SelectionAIPopup.tsx      # Anx 风格选段 AI 提问与多轮对话浮动面板
```

---

## 二、3 步在 GitHub 免费云端打包出 Android APK（无需电脑配环境）

你不需要在自己电脑上安装几十 GB 的 Android Studio、NDK 和 Rust 工具链，只需用 GitHub 网页操作：

### 第 1 步：Fork 官方仓库
1. 打开 [https://github.com/readest/readest](https://github.com/readest/readest)，点击右上角 **Fork** 到你自己的 GitHub 账号下。

### 第 2 步：把改造包里的文件上传到你的仓库
解压 `readest-anx-ai-selection-mod.zip`，按对应路径将以下 5 个文件上传到你 Fork 的仓库中（可在网页端点击 `Add file → Upload files` 或用 Git 提交）：
1. `apply-ai-feature.mjs` （放在仓库**根目录**）
2. `.github/workflows/build-android-ai-apk.yml` （放在 `.github/workflows/` 目录下）
3. `apps/readest-app/src/store/aiAskStore.ts`
4. `apps/readest-app/src/services/ai/selectionAskClient.ts`
5. `apps/readest-app/src/app/reader/components/annotator/SelectionAIPopup.tsx`

> **省心设计**：你甚至**不需要手动去改** `Annotator.tsx` 和 `AnnotationPopup.tsx`！因为工作流在云端编译的第 5 步会自动运行 `node apply-ai-feature.mjs`，自动帮你把「✨ 问 AI」按钮挂载进阅读器，并自动解除官方自定义翻译器和 AI 词典的权限锁。

### 第 3 步：一键触发云端编译并下载 APK
1. 在你 Fork 的 GitHub 仓库顶部点击 **Actions**（如果提示 Workflows 被禁用，点击绿色按钮 `I understand my workflows, go ahead and enable them`）。
2. 在左侧列表点击 **Build Android APK (AI Selection + Unlocked)**。
3. 点击右侧的 **Run workflow** 按钮 → 保持默认 `aarch64`（适合所有主流 64 位安卓手机/平板/电纸书，编译最快）→ 点击绿色的 **Run workflow**。
4. 等待约 **12～18 分钟**编译完成后：
   - 直接回到你仓库主页右侧的 **Releases** 栏，就能看到自动发布的 **`Readest-AI-Unlocked-arm64.apk`**，用手机浏览器点开即可直接下载安装！
   - 或者点进刚才的 Actions 运行记录底部，在 **Artifacts** 区域下载 `Readest-AI-Unlocked-Android-APK`。

---

## 三、安装到手机后的使用方式

1. **注意事项（包名共存/覆盖说明）**：由于自编译 APK 使用的是你自己的自动签名证书，与官方 Google Play / GitHub 原版签名不同。如果你的手机上已经安装了官方原版 Readest，请先备份书籍后卸载原版，再安装此改造版 APK。
2. **使用 Anx 风格「✨ 问 AI」**：
   - 打开任意书籍，长按选中一段文字，在弹出的工具栏点击 **「✨ 问 AI」**。
   - 首次使用时点击面板右上角的 **「⚙️ 设置」**，选择 `DeepSeek`、`OpenAI` 或 `Gemini`，填入你的 API Key 即可开始点击胶囊提问或自由追问。
3. **使用官方内置 AI 语境词典与全书翻译**：
   - 进入 `Settings → Language → Custom Translators`，添加你的 OpenAI 兼容接口（如 DeepSeek 或 Gemini）。
   - 进入 `Settings → Language → Manage Dictionaries` 开启 `Context Dictionary`，即可在查词时同时获得 AI 语境解析。
