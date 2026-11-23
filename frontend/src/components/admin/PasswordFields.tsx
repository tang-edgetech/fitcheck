"use client";

import { Form, Input } from "antd";

/** New password + confirm, matching the server policy (length, upper, lower, number, symbol). */
export default function PasswordFields({ min }: { min: number }) {
  return (
    <>
      <Form.Item
        name="password"
        label="New password"
        extra={`At least ${min} characters, with upper and lower case letters, a number and a symbol.`}
        rules={[
          { required: true, message: "Enter a new password" },
          { min, message: `Use at least ${min} characters` },
          { pattern: /[a-z]/, message: "Add a lower-case letter" },
          { pattern: /[A-Z]/, message: "Add an upper-case letter" },
          { pattern: /\d/, message: "Add a number" },
          { pattern: /[^A-Za-z0-9]/, message: "Add a symbol, such as ! or @" },
        ]}
        hasFeedback
      >
        <Input.Password autoComplete="new-password" />
      </Form.Item>
      <Form.Item
        name="password_confirmation"
        label="Repeat new password"
        dependencies={["password"]}
        hasFeedback
        rules={[
          { required: true, message: "Repeat the new password" },
          ({ getFieldValue }) => ({ validator: (_, v) => (!v || getFieldValue("password") === v ? Promise.resolve() : Promise.reject(new Error("The passwords don't match"))) }),
        ]}
      >
        <Input.Password autoComplete="new-password" />
      </Form.Item>
    </>
  );
}
