import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合并 className 工具：用 clsx 处理条件 className，再用 tailwind-merge 解决冲突。
 * shadcn/ui 标准工具函数。
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
