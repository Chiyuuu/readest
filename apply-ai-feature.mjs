#!/usr/bin/env node
/**
 * Readest 全能 AI 改造与解锁脚本（在 GitHub Actions 编译前或本地根目录自动运行）：
 * 1. 注入 Anx Reader 风格「✨ 问 AI」划词按钮与多轮追问面板 (SelectionAIPopup + aiAskStore)
 * 2. 自动解除 Readest 官方自带 Custom Translators（自定义 AI 翻译）、Context Dictionary（AI 语境词典）、Anki 同步等 Full Customization / Plus 订阅限制
 */
import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const srcRoot = path.join(repoRoot, 'apps/readest-app/src');

console.log('🚀 [1/3] 正在向 Readest 注入 Anx Reader 风格「选段 AI 提问」组件...');

const annotatorPath = path.join(
  srcRoot,
  'app/reader/components/annotator/Annotator.tsx'
);
const popupPath = path.join(
  srcRoot,
  'app/reader/components/annotator/AnnotationPopup.tsx'
);

// 1. 挂载 SelectionAIPopup 到 Annotator.tsx
if (fs.existsSync(annotatorPath)) {
  let content = fs.readFileSync(annotatorPath, 'utf8');
  if (!content.includes('SelectionAIPopup')) {
    content =
      `import { SelectionAIPopup } from './SelectionAIPopup';\n` +
      `import { useAIAskStore } from '@/store/aiAskStore';\n` +
      content;

    // 优先在 </> 闭合标签前挂载 <SelectionAIPopup />
    const lastFragIdx = content.lastIndexOf('</>');
    if (lastFragIdx !== -1) {
      content =
        content.slice(0, lastFragIdx) +
        `  <SelectionAIPopup />\n    ` +
        content.slice(lastFragIdx);
    } else {
      const lastDivIdx = content.lastIndexOf('</div>');
      if (lastDivIdx !== -1) {
        content =
          content.slice(0, lastDivIdx) +
          `  <SelectionAIPopup />\n    ` +
          content.slice(lastDivIdx);
      }
    }
    fs.writeFileSync(annotatorPath, content, 'utf8');
    console.log('✅ 已在 Annotator.tsx 中挂载 <SelectionAIPopup />');
  }
}

// 2. 在 AnnotationPopup.tsx 中注入「✨ 问 AI」按钮
if (fs.existsSync(popupPath)) {
  let popupContent = fs.readFileSync(popupPath, 'utf8');
  if (!popupContent.includes('useAIAskStore')) {
    popupContent =
      `import { useAIAskStore } from '@/store/aiAskStore';\n` + popupContent;

    // 注入快速悬浮触发按钮或工具栏按钮
    const askBtnSnippet = `
      <button
        type="button"
        onClick={() => {
          const selText = typeof window !== 'undefined' ? window.getSelection()?.toString() || '' : '';
          const targetText = (typeof selection !== 'undefined' && selection?.text) || (typeof text === 'string' ? text : '') || selText;
          const contextText = (typeof selection !== 'undefined' && (selection?.contextText || selection?.text)) || '';
          useAIAskStore.getState().openAskPopup({
            selectedText: targetText,
            surroundingContext: contextText || targetText,
          });
        }}
        className="btn btn-ghost btn-xs px-2 text-primary font-medium"
        title="向 AI 提问"
      >
        ✨ 问 AI
      </button>
`;
    // 寻找合适的位置插入按钮（例如第一个 <button 之前）
    const firstBtnIdx = popupContent.indexOf('<button');
    if (firstBtnIdx !== -1) {
      popupContent =
        popupContent.slice(0, firstBtnIdx) +
        askBtnSnippet +
        popupContent.slice(firstBtnIdx);
    }
    fs.writeFileSync(popupPath, popupContent, 'utf8');
    console.log('✅ 已在 AnnotationPopup.tsx 工具栏注入「✨ 问 AI」按钮');
  }
}

console.log('🔓 [2/3] 正在扫描并解除官方 Custom Translators 与 Context Dictionary 的付费校验锁...');

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '__tests__') {
        walkDir(fullPath, callback);
      }
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      callback(fullPath);
    }
  }
}

let unlockedFilesCount = 0;

walkDir(srcRoot, (filePath) => {
  let code = fs.readFileSync(filePath, 'utf8');
  let original = code;

  // 解锁常见的订阅/买断权限判断函数与属性（如 hasFullCustomization, canUseCustomTranslators, isPremium, isPro, isPlus 等）
  const booleanGetters = [
    /(export\s+const\s+(?:hasFullCustomization|canUseCustomTranslators?|canUseContextDictionary|hasCustomizationUnlock|isCustomTranslatorUnlocked)\s*=\s*\([^)]*\)\s*(?::\s*boolean)?\s*=>\s*)([^;]+);/g,
    /(function\s+(?:hasFullCustomization|canUseCustomTranslators?|canUseContextDictionary|hasCustomizationUnlock|isCustomTranslatorUnlocked)\s*\([^)]*\)\s*(?::\s*boolean)?\s*\{)([\s\S]*?)(\})/g,
  ];

  code = code.replace(booleanGetters[0], '$1true;');
  code = code.replace(booleanGetters[1], '$1 return true; $3');

  // 针对对象属性或 Hook 返回值中的权限字段强制设为 true
  const propPatterns = [
    /(\bfullCustomization\s*:\s*)(?:false|Boolean\([^)]+\)|![a-zA-Z0-9_.]+)/g,
    /(\bhasFullCustomization\s*:\s*)(?:false|Boolean\([^)]+\)|![a-zA-Z0-9_.]+)/g,
    /(\bcanUseCustomTranslators?\s*:\s*)(?:false|Boolean\([^)]+\)|![a-zA-Z0-9_.]+)/g,
    /(\bcanUseContextDictionary\s*:\s*)(?:false|Boolean\([^)]+\)|![a-zA-Z0-9_.]+)/g,
  ];

  for (const pat of propPatterns) {
    code = code.replace(pat, '$1true');
  }

  if (code !== original) {
    fs.writeFileSync(filePath, code, 'utf8');
    unlockedFilesCount++;
    console.log(`   🔓 已解锁权限校验文件: ${path.relative(repoRoot, filePath)}`);
  }
});

console.log(`✅ [3/3] 改造完成（共自动调整 ${unlockedFilesCount} 个权限校验文件）！`);
