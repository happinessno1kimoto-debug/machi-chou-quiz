#!/usr/bin/env node
// note-drafts/YYYY-MM-DD/{article.md,x-posts.md,design-brief.md} を読み、
// スマホでコピペしやすい「公開キット」HTMLを1枚生成する。
// 使い方: node note-drafts/tools/build-kit.mjs [出力先パス]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const draftsDir = path.resolve(__dirname, '..');
const outPath = process.argv[2] || path.join(draftsDir, 'kit.generated.html');

const dayDirs = fs
  .readdirSync(draftsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
  .map((d) => d.name)
  .sort()
  .reverse();

function parseArticle(text, day) {
  const titleMatch = text.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : '(タイトル未設定)';
  if (!titleMatch) console.warn(`[${day}] article.md: タイトル行(# ...)が見つかりません`);

  const priceMatch = text.match(/価格案[:：]\s*([0-9,]+円)/);
  const price = priceMatch ? priceMatch[1] : '(価格未設定)';
  if (!priceMatch) console.warn(`[${day}] article.md: 価格案の行が見つかりません`);

  const bodyStart = text.indexOf('\n---\n');
  if (bodyStart < 0) console.warn(`[${day}] article.md: 本文区切りの "---" が見つかりません(全文をfreePart扱いにします)`);
  const body = bodyStart >= 0 ? text.slice(bodyStart + 5) : text;

  const paidMarker = '---ここから有料---';
  const paidIdx = body.indexOf(paidMarker);
  if (paidIdx < 0) console.warn(`[${day}] article.md: "${paidMarker}" が見つかりません(paidPartが空になります)`);
  const freePart = (paidIdx >= 0 ? body.slice(0, paidIdx) : body).trim();
  const paidPart = paidIdx >= 0 ? body.slice(paidIdx + paidMarker.length).trim() : '';

  return { title, price, freePart, paidPart };
}

function parseXPosts(text, day) {
  const posts = [];
  const re = /\*\*#(\d+)\(([^)]+)\)\*\*\s*\n```\n([\s\S]*?)\n```/g;
  let m;
  while ((m = re.exec(text))) {
    posts.push({ num: m[1], label: m[2].trim(), body: m[3].trim() });
  }
  if (posts.length === 0) console.warn(`[${day}] x-posts.md: 投稿が1件もパースできませんでした(フォーマットを確認してください)`);
  return posts;
}

function parseDesignBrief(text) {
  const urlMatch = text.match(/https:\/\/claude\.ai\/code\/artifact\/[a-zA-Z0-9-]+/);
  return { url: urlMatch ? urlMatch[0] : null };
}

const days = [];
for (const day of dayDirs) {
  const dir = path.join(draftsDir, day);
  const articlePath = path.join(dir, 'article.md');
  const xPostsPath = path.join(dir, 'x-posts.md');
  const designBriefPath = path.join(dir, 'design-brief.md');
  if (!fs.existsSync(articlePath)) continue;

  const article = parseArticle(fs.readFileSync(articlePath, 'utf8'), day);
  const xPosts = fs.existsSync(xPostsPath) ? parseXPosts(fs.readFileSync(xPostsPath, 'utf8'), day) : [];
  const design = fs.existsSync(designBriefPath)
    ? parseDesignBrief(fs.readFileSync(designBriefPath, 'utf8'))
    : { url: null };

  days.push({ date: day, ...article, xPosts, designUrl: design.url });
}

if (days.length === 0) {
  console.error('note-drafts/ 配下に YYYY-MM-DD/article.md が見つかりませんでした。');
  process.exit(1);
}

const templatePath = path.join(__dirname, 'kit-template.html');
const template = fs.readFileSync(templatePath, 'utf8');
const html = template.replace('/*__KIT_DATA__*/null', JSON.stringify(days));

fs.writeFileSync(outPath, html, 'utf8');
console.log(`wrote ${outPath} (${days.length} day(s): ${days.map((d) => d.date).join(', ')})`);
