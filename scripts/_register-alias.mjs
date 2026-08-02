/** 注册 @/ 别名解析钩子。用法：node --import ./scripts/_register-alias.mjs <script> */
import { register } from 'node:module';
register('./_alias-loader.mjs', import.meta.url);
