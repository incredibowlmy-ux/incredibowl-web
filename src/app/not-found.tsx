import type { Metadata } from "next";
import NotFoundBody from "./NotFoundBody";

// 品牌化 404。根 layout 不带 NavBar/Footer，所以这一页自己撑满整屏并铺纸底色
// （body 默认是 kraft #F4EFE6，不显式给 bg 会露出旧底色）。
// 这一页同时服务 /en/* 的未匹配路由：正文在 NotFoundBody 里按路径切语言
// （server 组件拿不到 pathname，metadata 又只能从 server 组件导出，所以拆两层）。
export const metadata: Metadata = {
  title: "页面不存在 · Incredibowl",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return <NotFoundBody />;
}
