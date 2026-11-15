#!/usr/bin/env node
/**
 * Readest 全能 AI 改造脚本（在 GitHub Actions 编译前于仓库根目录运行，幂等）：
 *
 * 1. 校验 Anx Reader 风格「✨ 问 AI」划词组件是否已就位
 *    （SelectionAIPopup / aiAskStore / selectionAskClient / Annotator 挂载点）
 * 2. 解锁 Readest 官方 AI 功能的付费校验：把 utils/access.ts 里的
 *    `isCustomizationAllowed` 改为恒等 true，从而同时放开
 *      - Custom Translators（自定义 OpenAI / DeepSeek / Gemini 翻译器）
 *      - Context Dictionary（AI 语境词典）
 *      - 以及所有走同一道闸的 Plus/Pro 功能（云同步 / 离线 TTS / Anki 等）
 *
 * 说明：早期版本靠正则往 Annotator.tsx / AnnotationPopup.tsx 里塞 <button>，
 * 但上游工具栏已改成 buttons 数组渲染，注入既插不进去、还会留下未使用的 import
 * 让 `tsc` 报 TS6133 直接构建失败。现在组件挂载点已在仓库里做好，
 * 本脚本只做校验 + 幂等解锁，不再改动组件代码。
 */
import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const srcRoot = path.join(repoRoot, 'apps/readest-app/src');
const rel = (p) => path.relative(repoRoot, p);

const log = (...args) => console.log(...args);
let failed = false;

function check(relPath, mustInclude) {
  const p = path.join(srcRoot, relPath);
  if (!fs.existsSync(p)) {
    log(`缺少文件: ${relPath}`);
    failed = true;
    return;
  }
  const code = fs.readFileSync(p, 'utf8');
  for (const needle of mustInclude) {
    if (!code.includes(needle)) {
      log(`WARN ${relPath} 中找不到: ${needle}`);
      failed = true;
    }
  }
}

log('[1/2] 校验 Anx Reader 风格「问 AI」划词组件...');
check('store/aiAskStore.ts', ['useAIAskStore', 'openAskPopup']);
check('services/ai/selectionAskClient.ts', ['streamSelectionAsk', 'renderPromptTemplate']);
check('app/reader/components/annotator/SelectionAIPopup.tsx', ['SelectionAIPopup']);
check('app/reader/components/annotator/Annotator.tsx', [
  "from './SelectionAIPopup'",
  '<SelectionAIPopup />',
  'handleAskAI',
  'annotationToolbarButtons',
]);
if (failed) {
  log('组件挂载点不完整，构建终止（避免打出一个没有「问 AI」按钮的包）。');
  process.exit(1);
}
log('OK 划词 AI 面板挂载点完整');

log('[2/2] 解锁官方 Custom Translators / Context Dictionary 付费校验...');
const accessPath = path.join(srcRoot, 'utils/access.ts');
if (!fs.existsSync(accessPath)) {
  log('找不到 utils/access.ts');
  process.exit(1);
}

let code = fs.readFileSync(accessPath, 'utf8');

if (code.includes('[ai-unlock]')) {
  log('OK 权限闸门已处于解锁状态，跳过');
} else {
  const re =
    /export const isCustomizationAllowed\s*=\s*\([^)]*\)\s*:\s*boolean\s*=>\s*\n?[\s\S]*?;\n/;
  if (!re.test(code)) {
    log('未找到 isCustomizationAllowed，上游可能改版，需人工确认');
    process.exit(1);
  }
  code = code.replace(
    re,
    'export const isCustomizationAllowed = (_plan: UserPlan, _customizationPurchased: boolean): boolean =>\n' +
      '  // [ai-unlock] 解除 Plus/Pro 与 Full Customization 校验：自定义翻译器 / AI 语境词典全开\n' +
      '  true;\n',
  );
  fs.writeFileSync(accessPath, code, 'utf8');
  log(`OK 已解锁: ${rel(accessPath)} (isCustomizationAllowed -> true)`);
}

log('改造完成');
