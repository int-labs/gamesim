import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Box, Boxes, LogOut, Megaphone, Puzzle, ShoppingBag, Store } from "lucide-react";
import type { AnchorHTMLAttributes } from "react";
import { vi } from "vitest";
import { Wordmark } from "../../foundations/text/Wordmark";
import {
  Sidebar,
  SidebarAccount,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarNav,
  SidebarSection,
  SidebarSubItem,
  type SidebarProps,
} from "./Sidebar";
import { SidebarMenuContext } from "./SidebarContext";

function AdminSidebar(props: Partial<SidebarProps> & { onLogOut?: () => void; onAccount?: () => void }) {
  const { onLogOut, onAccount, ...rest } = props;
  return (
    <Sidebar {...rest}>
      <SidebarHeader brand={<Wordmark>intlabs.</Wordmark>}>
        <SidebarAccount label="facilitator@example.com" onClick={onAccount} />
      </SidebarHeader>
      <SidebarNav>
        <SidebarSection title="Simulation management">
          <SidebarItem icon={Boxes} label="Simulations" href="/simulations" active />
          <SidebarItem icon={Box} label="Products" href="/products" />
          <SidebarItem icon={Puzzle} label="Initiatives" href="/initiatives" />
          <SidebarItem icon={Megaphone} label="Events" href="/events" />
        </SidebarSection>
      </SidebarNav>
      <SidebarFooter>
        <SidebarItem icon={LogOut} label="Log Out" tone="danger" onClick={onLogOut} />
      </SidebarFooter>
    </Sidebar>
  );
}

describe("Sidebar", () => {
  it("is a navigation landmark with a labelled group of links, the current one marked", () => {
    render(<AdminSidebar />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    const group = within(nav).getByRole("group", { name: "Simulation management" });
    const links = within(group).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Simulations", "Products", "Initiatives", "Events"]);
    expect(within(group).getByRole("link", { name: "Simulations" })).toHaveAttribute("aria-current", "page");
    expect(within(group).getByRole("link", { name: "Products" })).not.toHaveAttribute("aria-current");
  });

  it("collapses to the icon rail and back, keeping every name for assistive technology", async () => {
    const onCollapsedChange = vi.fn();
    const { container } = render(<AdminSidebar onCollapsedChange={onCollapsedChange} onAccount={() => {}} />);
    const aside = container.querySelector("aside");
    expect(aside?.className).toContain("w-(--sidebar-width)");

    await userEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(onCollapsedChange).toHaveBeenLastCalledWith(true);
    expect(aside?.className).toContain("w-(--sidebar-width-collapsed)");
    expect(aside).toHaveAttribute("data-collapsed");
    // The brand leaves the rail (it keeps its row height, hidden); labels stay readable to screen readers.
    expect(screen.getByText("intlabs.").parentElement).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("link", { name: "Simulations" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Simulation management" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit account: facilitator@example.com" })).toBeInTheDocument();

    const expand = screen.getByRole("button", { name: "Expand sidebar" });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(expand);
    expect(onCollapsedChange).toHaveBeenLastCalledWith(false);
    expect(aside?.className).toContain("w-(--sidebar-width)");
    expect(screen.getByText("intlabs.").parentElement).not.toHaveAttribute("aria-hidden");
  });

  it("can be controlled", () => {
    const { rerender, container } = render(<AdminSidebar collapsed />);
    expect(container.querySelector("aside")).toHaveAttribute("data-collapsed");
    rerender(<AdminSidebar collapsed={false} />);
    expect(container.querySelector("aside")).not.toHaveAttribute("data-collapsed");
  });

  it("makes items without a link into buttons (Log Out), and runs them", async () => {
    const onLogOut = vi.fn();
    const onAccount = vi.fn();
    render(<AdminSidebar onLogOut={onLogOut} onAccount={onAccount} />);
    await userEvent.click(screen.getByRole("button", { name: "Log Out" }));
    expect(onLogOut).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "Edit account: facilitator@example.com" }));
    expect(onAccount).toHaveBeenCalledOnce();
  });

  it("shows the sub items of an open unit, marking the unit as the current section", () => {
    const tree = (expanded: boolean) => (
      <Sidebar>
        <SidebarNav>
          <SidebarSection title="Business unit">
            <SidebarItem icon={ShoppingBag} label="Retail Mass" href="/retail-mass" active expanded={expanded}>
              <SidebarSubItem label="Deposit" href="/retail-mass/deposit" active />
              <SidebarSubItem label="Loan" href="/retail-mass/loan" />
            </SidebarItem>
            <SidebarItem icon={Store} label="SME" href="/sme" />
          </SidebarSection>
        </SidebarNav>
      </Sidebar>
    );
    const { rerender } = render(tree(false));
    expect(screen.queryByRole("link", { name: "Deposit" })).toBeNull();
    rerender(tree(true));
    expect(screen.getByRole("link", { name: "Retail Mass" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Deposit" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Loan" })).not.toHaveAttribute("aria-current");
    // The sub items are a list inside the unit's list item.
    const unit = screen.getByRole("link", { name: "Retail Mass" }).closest("li");
    expect(within(unit as HTMLElement).getAllByRole("listitem")).toHaveLength(2);
  });

  it("names each item and the account in a tooltip beside the collapsed rail, and only there", async () => {
    const user = userEvent.setup();
    /** Tabs (backwards with shift) until the element has focus, as a keyboard user would reach it. */
    const tabTo = async (element: HTMLElement, shift = false) => {
      for (let step = 0; step < 10 && document.activeElement !== element; step += 1) await user.tab({ shift });
      expect(element).toHaveFocus();
    };
    const { rerender } = render(<AdminSidebar collapsed onAccount={() => {}} />);
    const products = screen.getByRole("link", { name: "Products" });
    await tabTo(products);
    expect(await screen.findByText("Products", { selector: "[data-open]" })).toBeInTheDocument();
    // The link keeps its name for screen readers, so the tooltip adds no description.
    expect(products).not.toHaveAttribute("aria-describedby");

    const logOut = screen.getByRole("button", { name: "Log Out" });
    await tabTo(logOut);
    expect(await screen.findByText("Log Out", { selector: "[data-open]" })).toBeInTheDocument();

    await tabTo(screen.getByRole("button", { name: "Edit account: facilitator@example.com" }), true);
    expect(await screen.findByText("facilitator@example.com", { selector: "[data-open]" })).toBeInTheDocument();

    rerender(<AdminSidebar collapsed={false} onAccount={() => {}} />);
    await tabTo(products);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(document.querySelector("[data-open]")).toBeNull();
  });

  it("hides sub items on the collapsed rail", () => {
    render(
      <Sidebar collapsed>
        <SidebarNav>
          <SidebarSection title="Business unit">
            <SidebarItem icon={ShoppingBag} label="Retail Mass" href="/retail-mass" active expanded>
              <SidebarSubItem label="Deposit" href="/retail-mass/deposit" active />
            </SidebarItem>
          </SidebarSection>
        </SidebarNav>
      </Sidebar>,
    );
    expect(screen.getByRole("link", { name: "Retail Mass" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Deposit" })).toBeNull();
  });

  it("in the mobile menu, closes it when a page is chosen, also through a router link that cancels the click", async () => {
    const closeMenu = vi.fn();
    const fold = vi.fn();
    // A router link navigates by cancelling the browser's own navigation.
    const routerLink = <a href="#sme" onClick={(event) => event.preventDefault()} />;
    render(
      <SidebarMenuContext.Provider value={closeMenu}>
        <Sidebar collapsed>
          <SidebarNav>
            <SidebarSection>
              <SidebarItem icon={ShoppingBag} label="Retail Mass" active expanded onClick={fold}>
                <SidebarSubItem label="Deposit" href="#deposit" active />
              </SidebarItem>
              <SidebarItem icon={Store} label="SME" render={routerLink} />
            </SidebarSection>
          </SidebarNav>
        </Sidebar>
      </SidebarMenuContext.Provider>,
    );
    // In the menu the sidebar is never the rail, even when asked to be.
    expect(screen.getByText("SME")).not.toHaveClass("max-w-0");
    // The open unit, as a button, folds its products and keeps the menu open.
    const unit = screen.getByRole("button", { name: "Retail Mass" });
    expect(unit).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(unit);
    expect(fold).toHaveBeenCalledOnce();
    expect(closeMenu).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("link", { name: "SME" }));
    expect(closeMenu).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("link", { name: "Deposit" }));
    expect(closeMenu).toHaveBeenCalledTimes(2);
  });
});

/** Ends the sidebar's width transition, as the browser does once it has finished moving. */
function endWidthTransition(aside: Element) {
  const event = new Event("transitionend", { bubbles: true });
  Object.defineProperty(event, "propertyName", { value: "width" });
  act(() => {
    aside.dispatchEvent(event);
  });
}

describe("SidebarItem names, pictures and dimmed items", () => {
  const LONG = "ProCare Industrial Detergent";

  function UnitSidebar(props: Partial<SidebarProps>) {
    return (
      <Sidebar {...props}>
        <SidebarNav>
          <SidebarSection title="Business unit">
            <SidebarItem icon={ShoppingBag} label={LONG} href="/procare" active expanded>
              <SidebarSubItem label="Global Transaction Services" href="/procare/gts" active />
            </SidebarItem>
          </SidebarSection>
        </SidebarNav>
      </Sidebar>
    );
  }

  it("lets a long name take a second line, and the row grow with it", () => {
    render(<UnitSidebar />);
    expect(screen.getByText(LONG)).toHaveClass("line-clamp-2");
    expect(screen.getByText("Global Transaction Services")).toHaveClass("line-clamp-2");
    // The row is at least as tall as Figma's, and grows past it.
    expect(screen.getByRole("link", { name: LONG }).className).toContain("min-h-(--sidebar-item-height)");
  });

  it("keeps names to one line while the width moves, and wraps them once it has come to rest", () => {
    const { container, rerender } = render(<UnitSidebar collapsed />);
    const aside = container.querySelector("aside") as HTMLElement;
    expect(screen.getByText(LONG)).toHaveClass("truncate");

    rerender(<UnitSidebar collapsed={false} />);
    // Widening: one line until the width has finished moving.
    expect(screen.getByText(LONG)).toHaveClass("truncate");
    endWidthTransition(aside);
    expect(screen.getByText(LONG)).toHaveClass("line-clamp-2");

    // Narrowing: one line at once.
    rerender(<UnitSidebar collapsed />);
    expect(screen.getByText(LONG)).toHaveClass("truncate");
  });

  it("shows a picture in the icon's place, and the icon when the picture can't be shown", () => {
    const { container } = render(
      <Sidebar>
        <SidebarNav>
          <SidebarSection>
            <SidebarItem icon={Store} picture="https://example.com/aabc.webp" label="AABC Bank" href="/aabc" />
          </SidebarSection>
        </SidebarNav>
      </Sidebar>,
    );
    const link = screen.getByRole("link", { name: "AABC Bank" });
    const picture = link.querySelector("img") as HTMLImageElement;
    expect(picture).toHaveAttribute("src", "https://example.com/aabc.webp");
    // It decorates the name, which the link already reads.
    expect(picture).toHaveAttribute("alt", "");
    expect(link.querySelector("svg")).toBeNull();

    fireEvent.error(picture);
    expect(container.querySelector("img")).toBeNull();
    expect(link.querySelector("svg")).not.toBeNull();
  });

  it("puts a sub item's picture before its name", () => {
    render(
      <Sidebar>
        <SidebarNav>
          <SidebarSection>
            <SidebarItem icon={Store} label="Enterprise" active expanded>
              <SidebarSubItem label="AABC Bank" picture="https://example.com/file-text.webp" href="/report/aabc" />
            </SidebarItem>
          </SidebarSection>
        </SidebarNav>
      </Sidebar>,
    );
    const sub = screen.getByRole("link", { name: "AABC Bank" });
    expect(sub.firstElementChild?.tagName).toBe("IMG");
  });

  it("dims an item that isn't open yet: out of the tab order, and choosing it does nothing", () => {
    const onUnit = vi.fn();
    const onProduct = vi.fn();
    const navigated = vi.fn();
    // As React Router's Link: it runs the click handlers it is given, then navigates unless one
    // of them cancelled the click.
    function RouterLink({ onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
      return (
        <a
          {...props}
          onClick={(event) => {
            onClick?.(event);
            if (event.defaultPrevented) return;
            event.preventDefault();
            navigated();
          }}
        />
      );
    }
    const routerLink = <RouterLink href="#sme" />;
    render(
      <Sidebar>
        <SidebarNav>
          <SidebarSection title="Business unit">
            <SidebarItem icon={Store} label="SME" render={routerLink} onClick={onUnit} disabled />
            <SidebarItem icon={ShoppingBag} label="Retail Mass" active expanded disabled>
              <SidebarSubItem label="Deposit" href="#deposit" onClick={onProduct} disabled />
            </SidebarItem>
          </SidebarSection>
        </SidebarNav>
      </Sidebar>,
    );
    const sme = screen.getByRole("link", { name: "SME" });
    expect(sme).toHaveAttribute("aria-disabled", "true");
    expect(sme).toHaveAttribute("tabindex", "-1");
    fireEvent.click(sme);
    expect(onUnit).not.toHaveBeenCalled();
    expect(navigated).not.toHaveBeenCalled();

    expect(screen.getByRole("button", { name: "Retail Mass" })).toBeDisabled();
    const deposit = screen.getByRole("link", { name: "Deposit" });
    expect(deposit).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(deposit);
    expect(onProduct).not.toHaveBeenCalled();
  });
});

describe("SidebarAccount", () => {
  it("shows the Admin email chip as a button that names its action", () => {
    render(
      <Sidebar>
        <SidebarAccount label="herdy_intlabs@gmail.com" actionLabel="Change password" onClick={() => {}} />
      </Sidebar>,
    );
    const chip = screen.getByRole("button", { name: "Change password: herdy_intlabs@gmail.com" });
    expect(chip.className).toContain("h-(--sidebar-account-height)");
  });

  it("shows a name with a role line, and only the name to assistive technology when collapsed", () => {
    const { rerender } = render(
      <Sidebar>
        <SidebarAccount label="Rido Hendrawan" description="Administrator" />
      </Sidebar>,
    );
    // Without onClick it is not a button.
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Rido Hendrawan")).toBeInTheDocument();
    expect(screen.getByText("Administrator")).toBeInTheDocument();
    rerender(
      <Sidebar collapsed>
        <SidebarAccount label="Rido Hendrawan" description="Administrator" />
      </Sidebar>,
    );
    expect(screen.getByText("Rido Hendrawan").closest(".sr-only")).not.toBeNull();
  });

  it("shows the team card with its avatar, on the rail too", () => {
    const { rerender } = render(
      <Sidebar>
        <SidebarAccount
          label="Team Anakin"
          description="Leader of Team Anakin"
          avatar={<img src="data:," alt="" />}
          actionLabel="Edit team details"
          onClick={() => {}}
        />
      </Sidebar>,
    );
    const card = screen.getByRole("button", { name: "Edit team details: Team Anakin" });
    expect(card.className).toContain("h-(--sidebar-profile-height)");
    expect(card.querySelector("img")).not.toBeNull();
    rerender(
      <Sidebar collapsed>
        <SidebarAccount label="Team Anakin" avatar={<img src="data:," alt="" />} actionLabel="Edit team details" onClick={() => {}} />
      </Sidebar>,
    );
    expect(screen.getByRole("button", { name: "Edit team details: Team Anakin" }).querySelector("img")).not.toBeNull();
  });
});
