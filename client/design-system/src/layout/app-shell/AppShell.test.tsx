import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Boxes, LogOut } from "lucide-react";
import { vi } from "vitest";
import { Wordmark } from "../../foundations/text/Wordmark";
import { Sidebar, SidebarFooter, SidebarHeader, SidebarItem, SidebarNav, SidebarSection } from "../sidebar/Sidebar";
import { AppShell } from "./AppShell";

function Shell({ fullBleed, onLogOut }: { fullBleed?: boolean; onLogOut?: () => void }) {
  return (
    <AppShell
      fullBleed={fullBleed}
      mobileBrand={<Wordmark>intlabs.</Wordmark>}
      sidebar={
        <Sidebar>
          <SidebarHeader brand={<Wordmark>intlabs.</Wordmark>} />
          <SidebarNav>
            <SidebarSection title="Simulation management">
              <SidebarItem icon={Boxes} label="Simulations" href="#simulations" active />
            </SidebarSection>
          </SidebarNav>
          <SidebarFooter>
            <SidebarItem icon={LogOut} label="Log Out" tone="danger" onClick={onLogOut} />
          </SidebarFooter>
        </Sidebar>
      }
    >
      <h1>Simulations</h1>
    </AppShell>
  );
}

describe("AppShell", () => {
  it("puts the page in the main landmark, with the page padding", () => {
    render(<Shell />);
    const main = screen.getByRole("main");
    expect(within(main).getByRole("heading", { name: "Simulations" })).toBeInTheDocument();
    expect(main.className).toContain("p-(--page-padding)");
  });

  it("makes its own parts design-system surfaces, and leaves the page to its own root", () => {
    const { container } = render(
      <AppShell
        sidebar={
          <Sidebar>
            <SidebarNav>
              <SidebarSection>
                <SidebarItem icon={Boxes} label="Simulations" href="#simulations" />
              </SidebarSection>
            </SidebarNav>
          </Sidebar>
        }
        mobileBrand={<Wordmark>intlabs.</Wordmark>}
        topBar={<section aria-label="Key metrics" />}
      >
        <p>A screen still on MUI</p>
      </AppShell>,
    );
    // An app still on MUI frames its screens with it; the reset stays out of the page.
    expect(container.querySelector("aside")?.closest("[data-ds-root]")).not.toBeNull();
    expect(screen.getByRole("banner")).toHaveAttribute("data-ds-root");
    expect(screen.getByRole("region", { name: "Key metrics" }).closest("[data-ds-root]")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("data-ds-root");
    expect(screen.getByRole("main").closest("[data-ds-root]")).toBeNull();
  });

  it("drops the padding for a full-bleed frame", () => {
    render(<Shell fullBleed />);
    expect(screen.getByRole("main").className).not.toContain("p-(--page-padding)");
  });

  it("lets keyboard users skip the sidebar, without touching the URL", async () => {
    render(<Shell />);
    await userEvent.tab();
    const skip = screen.getByRole("link", { name: "Skip to content" });
    expect(skip).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("main")).toHaveFocus();
    expect(window.location.hash).toBe("");
  });

  it("opens the sidebar as a menu on small screens, and closes it when a page is chosen", async () => {
    render(<Shell />);
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const menu = await screen.findByRole("dialog", { name: "Menu" });
    // Inside the menu the toggle closes it.
    expect(within(menu).getByRole("button", { name: "Close menu" })).toBeInTheDocument();
    await userEvent.click(within(menu).getByRole("link", { name: "Simulations" }));
    await vi.waitFor(() => expect(screen.queryByRole("dialog", { name: "Menu" })).toBeNull());
  });

  it("closes the menu with its close button, and keeps it open for an action like Log Out", async () => {
    const onLogOut = vi.fn();
    render(<Shell onLogOut={onLogOut} />);
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const menu = await screen.findByRole("dialog", { name: "Menu" });
    await userEvent.click(within(menu).getByRole("button", { name: "Log Out" }));
    expect(onLogOut).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeInTheDocument();
    await userEvent.click(within(menu).getByRole("button", { name: "Close menu" }));
    await vi.waitFor(() => expect(screen.queryByRole("dialog", { name: "Menu" })).toBeNull());
  });
});
