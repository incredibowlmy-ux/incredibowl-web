/**
 * Node ESM 解析钩子：把 `@/xxx` 映射到 `<repo>/src/xxx`，并补 `.ts`/`.tsx` 后缀。
 *
 * 为什么需要：dogfood 脚本要直接 import 生产代码（src/lib/*.ts）来验证逻辑，
 * 但生产代码用的是 tsconfig 的 `@/` 路径别名，裸 node 不认。Node 24 原生
 * strip-types 能跑 .ts，缺的只是别名解析这一环。
 *
 * 用法：node --import ./scripts/_register-alias.mjs scripts/xxx.mts
 *
 * 仅供本地脚本使用 —— next build 走 tsconfig，与此文件无关。
 */
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const SRC = path.resolve(import.meta.dirname, '..', 'src');
const EXTS = ['.ts', '.tsx', '.mts', '/index.ts', '/index.tsx'];

/** 逐个后缀试，命中返回绝对路径；都不中返回 null。 */
function tryExtensions(base) {
    if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
    for (const ext of EXTS) {
        const candidate = base + ext;
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
    return null;
}

export function resolve(specifier, context, next) {
    // ① `@/xxx` → <repo>/src/xxx
    if (specifier.startsWith('@/')) {
        const hit = tryExtensions(path.join(SRC, specifier.slice(2)));
        if (hit) return next(pathToFileURL(hit).href, context);
        throw new Error(`[alias-loader] 解析不了 ${specifier}`);
    }

    // ② `./xxx` / `../xxx` 无后缀 —— TS 允许省略，Node ESM 不允许。
    //    生产代码里到处都是（如 ingredientStock.ts 的 './prepIngredients'），
    //    不补这一环，dogfood 只要 import 到有相对依赖的模块就炸。
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !path.extname(specifier)) {
        const parent = context.parentURL?.startsWith('file:') ? fileURLToPath(context.parentURL) : null;
        if (parent) {
            const hit = tryExtensions(path.resolve(path.dirname(parent), specifier));
            if (hit) return next(pathToFileURL(hit).href, context);
        }
    }

    // ③ `next/server` 等子路径 —— Next 靠打包器解析，裸 node 认不出（报
    //    ERR_MODULE_NOT_FOUND）。补 `.js` 后缀让 API route 也能被 dogfood 直接
    //    import。命中不了就原样交回，不影响其它脚本。
    if (specifier.startsWith('next/') && !path.extname(specifier)) {
        const candidate = path.resolve(import.meta.dirname, '..', 'node_modules', `${specifier}.js`);
        if (fs.existsSync(candidate)) return next(pathToFileURL(candidate).href, context);
    }

    return next(specifier, context);
}
