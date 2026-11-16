// The sidebars of the Figma screens (Frame 38716), shared by the layout stories.
import {
  AppWindow,
  BaggageClaim,
  Box,
  Boxes,
  Building,
  Building2,
  HeartHandshake,
  KeyRound,
  Leaf,
  LogOut,
  Megaphone,
  PaintBucket,
  Puzzle,
  ScrollText,
  ShoppingBag,
  Sparkles,
  Store,
  Users,
} from "lucide-react";
import { expect, waitFor } from "storybook/test";
import {
  Avatar,
  RoundChip,
  Sidebar,
  SidebarAccount,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarNav,
  SidebarSection,
  SidebarSubItem,
  tokens,
  Wordmark,
} from "../../src";
import { anakinPicture, unitMark } from "../support/pictures";

/** The Admin sidebar, State=Maximize, Role=Admin. */
export function AdminSidebar({ defaultCollapsed = false }: { defaultCollapsed?: boolean }) {
  return (
    <Sidebar defaultCollapsed={defaultCollapsed}>
      <SidebarHeader brand={<Wordmark>intlabs.</Wordmark>}>
        <SidebarAccount label="herdy_intlabs@gmail.com" actionLabel="Change password" onClick={() => {}} />
      </SidebarHeader>
      <SidebarNav>
        <SidebarSection title="Simulation management">
          <SidebarItem icon={Boxes} label="Simulations" href="#simulations" active />
          <SidebarItem icon={Box} label="Products" href="#products" />
          <SidebarItem icon={Puzzle} label="Initiatives" href="#initiatives" />
          <SidebarItem icon={Megaphone} label="Events" href="#events" />
        </SidebarSection>
      </SidebarNav>
      <SidebarFooter>
        <SidebarItem icon={LogOut} label="Log Out" tone="danger" onClick={() => {}} />
      </SidebarFooter>
    </Sidebar>
  );
}

/** The V2 platform Admin (Session B): one sign-in for every app. */
export function PlatformSidebar() {
  return (
    <Sidebar>
      <SidebarHeader brand={<Wordmark>intlabs.</Wordmark>}>
        <SidebarAccount label="Rido Hendrawan" description="Administrator" actionLabel="Change password" onClick={() => {}} />
      </SidebarHeader>
      <SidebarNav>
        <SidebarSection title="Platform">
          <SidebarItem icon={AppWindow} label="Applications" href="#applications" active />
          <SidebarItem icon={Users} label="People" href="#people" />
          <SidebarItem icon={KeyRound} label="Access" href="#access" />
          <SidebarItem icon={ScrollText} label="Audit" href="#audit" />
        </SidebarSection>
        <SidebarSection title="Simulation management">
          <SidebarItem icon={Boxes} label="Simulations" href="#simulations" />
        </SidebarSection>
      </SidebarNav>
      <SidebarFooter>
        <SidebarItem icon={LogOut} label="Sign out" tone="danger" onClick={() => {}} />
      </SidebarFooter>
    </Sidebar>
  );
}

/** The team's picture (a stand-in for its DiceBear avatar, Figma avatar07). */
export function TeamAvatar() {
  return <Avatar name="Team Anakin" src={anakinPicture} />;
}

/** Waits for the team's picture, which arrives once loaded, so the screenshot shows it. */
export async function teamPictureLoaded(canvasElement: HTMLElement) {
  await waitFor(() => expect(canvasElement.querySelector("img")).not.toBeNull());
}

/** The player sidebar on Retail Mass - Deposit (Frame 38774), with the business units of the Banking simulation. */
export function PlayerSidebar({ defaultCollapsed = false }: { defaultCollapsed?: boolean }) {
  return (
    <Sidebar defaultCollapsed={defaultCollapsed}>
      <SidebarHeader brand={<Wordmark size="player">LIFE Bank.</Wordmark>} status={<RoundChip round={1} />}>
        <TeamCard />
      </SidebarHeader>
      <SidebarNav>
        <SidebarSection title="Business unit">
          <SidebarItem icon={ShoppingBag} label="Retail Mass" href="#retail-mass" active expanded>
            <SidebarSubItem label="Deposit" href="#retail-mass-deposit" active />
            <SidebarSubItem label="Loan" href="#retail-mass-loan" />
            <SidebarSubItem label="Credit Card" href="#retail-mass-credit-card" />
          </SidebarItem>
          <SidebarItem icon={BaggageClaim} label="Retail Affluent" href="#retail-affluent" />
          <SidebarItem icon={Store} label="SME" href="#sme" />
          <SidebarItem icon={Building} label="Corporate" href="#corporate" />
        </SidebarSection>
        <SidebarSection title="Company level decision">
          <SidebarItem icon={Building2} label="Enterprise" href="#enterprise" />
        </SidebarSection>
      </SidebarNav>
      <SidebarFooter>
        <SidebarItem icon={LogOut} label="Log Out" tone="danger" onClick={() => {}} />
      </SidebarFooter>
    </Sidebar>
  );
}

/** The player's team card, as every game's sidebar shows it. */
function TeamCard() {
  return (
    <SidebarAccount
      label="Team Anakin"
      description="Leader of Team Anakin"
      avatar={<TeamAvatar />}
      actionLabel="Edit team details"
      onClick={() => {}}
    />
  );
}

/**
 * The Product simulation's sidebar (Lumina), with a unit and a product named longer than a line
 * (as a translation or a facilitator's own names can be): the rows grow with them.
 */
export function LongNamesSidebar() {
  return (
    <Sidebar>
      <SidebarHeader brand={<Wordmark size="player">Lumina.</Wordmark>} status={<RoundChip round={2} />}>
        <TeamCard />
      </SidebarHeader>
      <SidebarNav>
        <SidebarSection title="Business unit">
          <SidebarItem icon={Leaf} label="EcoWash 3-in-1" href="#ecowash" />
          <SidebarItem icon={Sparkles} label="Nexa CleanSense" href="#nexa" />
          <SidebarItem icon={HeartHandshake} label="ProCare Industrial and Institutional Detergent" href="#procare" active expanded>
            <SidebarSubItem label="ProCare EcoGuard" href="#procare-ecoguard" active />
            <SidebarSubItem label="ProCare PowerWash Heavy Duty Formula" href="#procare-powerwash" />
            <SidebarSubItem label="ProCare EnzymeBoost+" href="#procare-enzymeboost" />
          </SidebarItem>
          <SidebarItem icon={PaintBucket} label="Bloom Detergent" href="#bloom" />
        </SidebarSection>
      </SidebarNav>
      <SidebarFooter>
        <SidebarItem icon={LogOut} label="Log Out" tone="danger" onClick={() => {}} />
      </SidebarFooter>
    </Sidebar>
  );
}

/**
 * The ET Prime sidebar (SimuBank): each bank with its own mark in the icon's place, and the
 * banks' reports below them, each with its page icon.
 */
export function MarksSidebar() {
  return (
    <Sidebar>
      <SidebarHeader brand={<Wordmark size="player">SimuBank.</Wordmark>} status={<RoundChip round={1} />}>
        <TeamCard />
      </SidebarHeader>
      <SidebarNav>
        <SidebarSection title="Business unit">
          <SidebarItem icon={Building} picture={unitMark(tokens.color.accent.DEFAULT)} label="AABC Bank" href="#bank-one" active expanded>
            <SidebarSubItem label="Retail" href="#bank-one-retail" active />
            <SidebarSubItem label="Group (SME and Corporate)" href="#bank-one-group" />
          </SidebarItem>
          <SidebarItem icon={Building} picture={unitMark(tokens.color.primary.DEFAULT)} label="Great Western" href="#great-western" />
          <SidebarItem icon={Building} picture={unitMark(tokens.color.success.DEFAULT)} label="Bank of Lionpura" href="#lionpura" />
        </SidebarSection>
        <SidebarSection title="Company level decision">
          <SidebarItem icon={Building2} label="Enterprise" expanded>
            <SidebarSubItem label="Financial Statements" href="#financials" />
            <SidebarSubItem label="AABC Bank" picture={unitMark(tokens.color.fg.subtle)} href="#report-bank-one" />
          </SidebarItem>
        </SidebarSection>
      </SidebarNav>
      <SidebarFooter>
        <SidebarItem icon={LogOut} label="Log Out" tone="danger" onClick={() => {}} />
      </SidebarFooter>
    </Sidebar>
  );
}

/**
 * A game whose group decisions come first: the business units show, dimmed, until the team has
 * submitted them.
 */
export function GroupFirstSidebar() {
  return (
    <Sidebar>
      <SidebarHeader brand={<Wordmark size="player">SimuBank.</Wordmark>} status={<RoundChip round={1} />}>
        <TeamCard />
      </SidebarHeader>
      <SidebarNav>
        <SidebarSection title="Group level">
          <SidebarItem icon={Building2} label="Group Strategy" href="#group-strategy" active />
        </SidebarSection>
        <SidebarSection title="Business unit">
          <SidebarItem icon={ShoppingBag} label="Retail" href="#retail" disabled />
          <SidebarItem icon={Store} label="SME" href="#sme" disabled />
          <SidebarItem icon={Building} label="Corporate" href="#corporate" disabled />
        </SidebarSection>
      </SidebarNav>
      <SidebarFooter>
        <SidebarItem icon={LogOut} label="Log Out" tone="danger" onClick={() => {}} />
      </SidebarFooter>
    </Sidebar>
  );
}
