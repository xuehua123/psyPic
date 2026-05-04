import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

/**
 * Phase 0 smoke tests:
 * - shadcn 基础元件可正常 render
 * - cn() / cva() / Radix Slot 集成无误
 * - 关键 a11y 属性保留（label / role / aria）
 */
describe("ui smoke", () => {
  describe("Button", () => {
    it("renders default variant and reacts to clicks", async () => {
      const onClick = vi.fn();
      render(<Button onClick={onClick}>生成图片</Button>);

      const trigger = screen.getByRole("button", { name: "生成图片" });
      expect(trigger).toBeInTheDocument();
      expect(trigger.getAttribute("data-slot")).toBe("button");

      await userEvent.click(trigger);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("supports asChild for slot composition", () => {
      render(
        <Button asChild>
          <a href="/community">前往社区</a>
        </Button>
      );

      const link = screen.getByRole("link", { name: "前往社区" });
      expect(link).toHaveAttribute("href", "/community");
      expect(link.getAttribute("data-slot")).toBe("button");
    });

    it("propagates variant + size className", () => {
      render(
        <Button variant="destructive" size="sm">
          删除
        </Button>
      );
      const trigger = screen.getByRole("button", { name: "删除" });
      expect(trigger.className).toMatch(/bg-destructive/);
      expect(trigger.className).toMatch(/h-8/);
    });
  });

  describe("Card", () => {
    it("renders title, description and content", () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>电商主图</CardTitle>
            <CardDescription>干净棚拍、主体居中</CardDescription>
          </CardHeader>
          <CardContent>1024 × 1024</CardContent>
        </Card>
      );

      expect(screen.getByText("电商主图")).toBeInTheDocument();
      expect(screen.getByText("干净棚拍、主体居中")).toBeInTheDocument();
      expect(screen.getByText("1024 × 1024")).toBeInTheDocument();
    });
  });

  describe("Badge", () => {
    it("renders all variants without crashing", () => {
      render(
        <>
          <Badge>默认</Badge>
          <Badge variant="secondary">次级</Badge>
          <Badge variant="outline">描边</Badge>
          <Badge variant="destructive">危险</Badge>
          <Badge variant="success">成功</Badge>
        </>
      );
      expect(screen.getByText("默认")).toBeInTheDocument();
      expect(screen.getByText("成功")).toBeInTheDocument();
    });
  });

  describe("Input + Label + Textarea", () => {
    it("links Label to Input via htmlFor and supports typing", async () => {
      render(
        <>
          <Label htmlFor="prompt">Prompt</Label>
          <Input id="prompt" placeholder="描述你想要生成的画面" />
        </>
      );
      const input = screen.getByLabelText("Prompt");
      await userEvent.type(input, "一只猫");
      expect(input).toHaveValue("一只猫");
    });

    it("renders Textarea with placeholder", () => {
      render(<Textarea placeholder="批量 Prompt，每行一条" />);
      expect(
        screen.getByPlaceholderText("批量 Prompt，每行一条")
      ).toBeInTheDocument();
    });
  });

  describe("Separator", () => {
    it("renders horizontal separator with role separator (default decorative=true → none)", () => {
      const { container } = render(<Separator />);
      const sep = container.querySelector("[data-slot=separator]");
      expect(sep).not.toBeNull();
      expect(sep?.getAttribute("data-orientation")).toBe("horizontal");
    });
  });
});
