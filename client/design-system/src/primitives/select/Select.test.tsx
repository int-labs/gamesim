import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { vi } from "vitest";
import { DecisionRow } from "../../game/decision/DecisionRow";
import { ResourceChip } from "../../game/resource-chip/ResourceChip";
import { Select } from "./Select";

const roles = [
  { value: "admin", label: "Administrator" },
  { value: "operator", label: "Operator" },
  { value: "client", label: "Client viewer" },
] as const;

function RoleFilter({ onChange }: { onChange: (value: string | null) => void }) {
  const [role, setRole] = useState<string | null>(null);
  return (
    <Select
      label="Role"
      placeholder="All roles"
      options={roles}
      value={role}
      onValueChange={(next) => {
        setRole(next);
        onChange(next);
      }}
    />
  );
}

describe("Select", () => {
  it("is named by its label and shows the placeholder until a value is chosen", async () => {
    const onChange = vi.fn();
    render(<RoleFilter onChange={onChange} />);
    const trigger = screen.getByRole("combobox", { name: "Role" });
    expect(trigger).toHaveTextContent("All roles");
    await userEvent.click(trigger);
    await userEvent.click(await screen.findByRole("option", { name: "Operator" }));
    expect(onChange).toHaveBeenLastCalledWith("operator");
    await vi.waitFor(() => expect(screen.getByRole("combobox", { name: "Role" })).toHaveTextContent("Operator"));
  });

  it("at width fit, keeps its labelled field as wide as its content rather than its row", () => {
    const { rerender } = render(<Select label="Round" width="fit" options={roles} defaultValue="admin" />);
    const field = () => screen.getByText("Round").parentElement;
    expect(field()).toHaveClass("w-fit");
    expect(field()).not.toHaveClass("w-full");
    rerender(<Select label="Round" options={roles} defaultValue="admin" />);
    expect(field()).toHaveClass("w-full");
  });

  it("can be named without a visible label, and disabled", () => {
    render(<Select aria-label="Rows per page" options={[{ value: "10", label: "10" }]} defaultValue="10" disabled />);
    const trigger = screen.getByRole("combobox", { name: "Rows per page" });
    expect(trigger).toHaveTextContent("10");
    expect(trigger).toHaveAttribute("data-disabled");
  });

  it("as a decision, is named and described by its row, and lists what each option costs", async () => {
    const onChange = vi.fn();
    render(
      <DecisionRow label="Branch Network Level" description="How many branches serve this product's customers.">
        <Select
          variant="decision"
          options={[
            { value: "0", label: "0", detail: <ResourceChip kind="energy" value={0} size="sm" /> },
            { value: "1", label: "+1", detail: <ResourceChip kind="energy" value={8} size="sm" /> },
            { value: "2", label: "+2", detail: <ResourceChip kind="energy" value={16} size="sm" />, disabled: true },
          ]}
          defaultValue="0"
          onValueChange={onChange}
        />
      </DecisionRow>,
    );
    const trigger = screen.getByRole("combobox", { name: "Branch Network Level" });
    expect(trigger).toHaveAccessibleDescription(/How many branches serve this product's customers\./);
    await userEvent.click(trigger);
    expect(await screen.findByRole("option", { name: "+1 Energy: 8" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "+2 Energy: 16" })).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(screen.getByRole("option", { name: "+1 Energy: 8" }));
    expect(onChange).toHaveBeenLastCalledWith("1");
    // The field shows the choice, not what it costs.
    await vi.waitFor(() => expect(screen.getByRole("combobox", { name: "Branch Network Level" })).toHaveTextContent(/^\+1$/));
  });
});
