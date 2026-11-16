// @stratagem/design-system. The stylesheet is a separate entry: @stratagem/design-system/styles.css.

// Tokens
export { motionTokens, tokens, type MotionDuration, type MotionEase, type MotionSpring, type Tokens } from "./tokens";

// Class helpers
export { cn } from "./lib/cn";
export { tv, type VariantProps } from "./lib/tv";

// Foundations: text
export { Heading, headingVariants, type HeadingProps } from "./foundations/text/Heading";
export { Text, textTones, textVariants, type TextProps } from "./foundations/text/Text";
export { Wordmark, wordmarkVariants, type WordmarkProps } from "./foundations/text/Wordmark";

// Foundations: icons
export {
  AnimatedIcon,
  IconPlayProvider,
  useIconPlay,
  type AnimatedIconHandle,
  type AnimatedIconProps,
  type AnimatedIconTrigger,
} from "./foundations/icon/AnimatedIcon";
export { iconAnimations, type IconAnimationName } from "./foundations/icon/animations";
export { SlashSeparator } from "./foundations/icon/glyphs";
export { Icon, iconSizes, iconStrokes, type IconProps, type IconSize, type IconStroke } from "./foundations/icon/Icon";
export { iconNames, iconRegistry, renamedIcons, resolveIcon, type IconName } from "./foundations/icon/registry";

// Foundations: motion
export { MotionProvider, useReducedEffects, type MotionProviderProps } from "./foundations/motion/MotionProvider";
export {
  enter,
  fade,
  hoverLift,
  nudge,
  press,
  scaleIn,
  shake,
  springs,
  staggerList,
  staggerReveal,
  successPop,
  transitions,
} from "./foundations/motion/presets";

// Foundations: numbers
export { NumberFormatProvider, useNumberFormat } from "./foundations/format/NumberFormatProvider";
export {
  createNumberFormatter,
  type MoneyOptions,
  type NumberFormatPolicy,
  type NumberFormatter,
} from "./foundations/format/numberFormat";

// Primitives: buttons
export { Button, type ButtonProps, type ButtonStatus } from "./primitives/button/Button";
export { type ButtonIconProps } from "./primitives/button/ButtonContent";
export { buttonVariants, type ButtonSize, type ButtonTone, type ButtonVariant } from "./primitives/button/buttonVariants";
export { LinkButton, type LinkButtonProps } from "./primitives/button/LinkButton";
export { IconButton, iconButtonVariants, type IconButtonProps } from "./primitives/icon-button/IconButton";
export { Spinner, type SpinnerProps } from "./primitives/spinner/Spinner";

// Primitives: forms
export { FormField, formFieldVariants, type FormFieldProps } from "./primitives/form-field/FormField";
export { Input, inputVariants, type InputProps } from "./primitives/input/Input";
export { PasswordField, TextField, type PasswordFieldProps, type TextFieldProps } from "./primitives/text-field/TextField";
export { TextArea, textAreaVariants, type TextAreaMessages, type TextAreaProps } from "./primitives/text-area/TextArea";
export { Select, selectVariants, type SelectOption, type SelectProps } from "./primitives/select/Select";
export { Combobox, comboboxVariants, type ComboboxMessages, type ComboboxOption, type ComboboxProps } from "./primitives/combobox/Combobox";
export { Switch, switchVariants, type SwitchProps } from "./primitives/switch/Switch";
export {
  defaultNumberFieldMessages,
  NumberField,
  numberFieldVariants,
  stripEmphasis,
  type NumberFieldLimits,
  type NumberFieldMessages,
  type NumberFieldProps,
} from "./primitives/number-field/NumberField";
export { PreviousValue, previousValueVariants, type PreviousValueProps } from "./primitives/number-field/PreviousValue";
export { Slider, sliderVariants, type SliderNumbersProps, type SliderProps, type SliderWordsProps } from "./primitives/slider/Slider";
export {
  Calendar,
  calendarVariants,
  type CalendarMessages,
  type CalendarProps,
  type DayRange,
  type RangeCalendarProps,
  type SingleCalendarProps,
} from "./primitives/date-picker/Calendar";
export {
  DatePicker,
  datePickerVariants,
  DateRangePicker,
  type DatePickerMessages,
  type DatePickerProps,
  type DateRangePickerProps,
} from "./primitives/date-picker/DatePicker";
export { formatDay, laterDay, parseDay, today, toDay, type DayString } from "./primitives/date-picker/days";

// Primitives: feedback
export { Alert, alertVariants, type AlertProps } from "./primitives/alert/Alert";
export { Skeleton, skeletonVariants, type SkeletonProps } from "./primitives/skeleton/Skeleton";
export {
  createToaster,
  ToastProvider,
  toastVariants,
  useToast,
  type Toaster,
  type ToastOptions,
  type ToastProviderProps,
  type ToastTone,
  type ToastVariant,
} from "./primitives/toast/Toast";

// Primitives: surfaces and data display
export { Avatar, avatarVariants, initialsOf, type AvatarProps } from "./primitives/avatar/Avatar";
export { AvatarBuilder, avatarBuilderVariants, type AvatarBuilderMessages, type AvatarBuilderProps } from "./primitives/avatar/AvatarBuilder";
export {
  avatarBackgrounds,
  avatarBackgroundsOf,
  avatarColours,
  avatarParts,
  avatarStyleKeys,
  avatarStyles,
  avatarUrl,
  defaultAvatarStyle,
  loadAvatarStyle,
  parseAvatarUrl,
  renderAvatar,
  type AvatarColour,
  type AvatarPart,
  type AvatarRecipe,
  type AvatarStyleKey,
} from "./primitives/avatar/dicebear";
export {
  AvatarPicker,
  avatarPickerVariants,
  photoOf,
  type AvatarChoice,
  type AvatarPickerMessages,
  type AvatarPickerProps,
} from "./primitives/avatar/AvatarPicker";
export {
  PhotoCropPreview,
  photoCropPreviewVariants,
  PhotoCropper,
  photoCropperVariants,
  type PhotoCropperMessages,
  type PhotoCropperProps,
  type PhotoCropPreviewProps,
} from "./primitives/avatar/PhotoCropper";
export {
  clampPhotoCrop,
  cropPhoto,
  defaultMaxZoom,
  initialPhotoCrop,
  loadPhoto,
  movePhotoCrop,
  turnPhotoCrop,
  zoomPhotoCrop,
  type CropPhotoOptions,
  type PhotoCrop,
  type QuarterTurn,
} from "./primitives/avatar/photoCrop";
export { Badge, badgeVariants, type BadgeProps } from "./primitives/badge/Badge";
export { Checkbox, type CheckboxProps } from "./primitives/checkbox/Checkbox";
export { Card, CardHeader, cardVariants, type CardHeaderProps, type CardProps } from "./primitives/card/Card";
export { EmptyState, emptyStateVariants, type EmptyStateProps } from "./primitives/empty-state/EmptyState";
export { FilterChip, filterChipVariants, type FilterChipProps } from "./primitives/filter-chip/FilterChip";

// Primitives: navigation
export { Tabs, TabsPanel, tabsVariants, type TabItem, type TabsPanelProps, type TabsProps } from "./primitives/tabs/Tabs";
export { Breadcrumb, type BreadcrumbItem, type BreadcrumbProps } from "./primitives/breadcrumb/Breadcrumb";

// Overlays
export {
  ConfirmDialog,
  Dialog,
  DialogClose,
  DialogPopup,
  DialogTrigger,
  dialogVariants,
  NoticeDialog,
  type ConfirmDialogProps,
  type DialogPopupProps,
  type NoticeDialogProps,
} from "./overlays/dialog/Dialog";
export {
  Menu,
  MenuCheckboxItem,
  MenuGroup,
  MenuItem,
  MenuLinkItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSubmenu,
  menuVariants,
  type MenuCheckboxItemProps,
  type MenuItemProps,
  type MenuLinkItemProps,
  type MenuProps,
  type MenuRadioGroupProps,
  type MenuRadioItemProps,
  type MenuSubmenuProps,
} from "./overlays/menu/Menu";
export {
  Tooltip,
  TooltipProvider,
  tooltipVariants,
  type TooltipAlign,
  type TooltipProps,
  type TooltipSide,
} from "./overlays/tooltip/Tooltip";
export { InfoTip, type InfoTipProps } from "./overlays/tooltip/InfoTip";

// Game: the player's pieces
export {
  BudgetField,
  budgetFieldVariants,
  defaultBudgetFieldMessages,
  type BudgetFieldMessages,
  type BudgetFieldProps,
} from "./game/budget-field/BudgetField";
export {
  DecisionCell,
  decisionColumnsVariants,
  DecisionPanel,
  DecisionRow,
  decisionVariants,
  type DecisionCellProps,
  type DecisionLevel,
  type DecisionPanelProps,
  type DecisionRowProps,
} from "./game/decision/DecisionRow";
export {
  DecisionTile,
  DecisionTiles,
  decisionTileVariants,
  type DecisionTileProps,
  type DecisionTilesProps,
} from "./game/decision/DecisionTile";
export {
  ReadOnlyField,
  readOnlyFieldVariants,
  ReadOnlyValue,
  readOnlyValueVariants,
  type ReadOnlyFieldProps,
  type ReadOnlyValueProps,
} from "./game/decision/ReadOnlyValue";
export { EnergyPill, energyPillVariants, type EnergyPillProps } from "./game/energy-pill/EnergyPill";
export {
  TeamDialog,
  teamDialogVariants,
  type TeamAvatarChange,
  type TeamDetails,
  type TeamDialogMessages,
  type TeamDialogProps,
} from "./game/team-dialog/TeamDialog";
export {
  defaultInitiativeHistoryMessages,
  defaultInitiativeTableMessages,
  InitiativeHistory,
  InitiativeTable,
  initiativeTableVariants,
  type InitiativeHistoryMessages,
  type InitiativeHistoryProps,
  type InitiativeHistoryRound,
  type InitiativeRow,
  type InitiativeSection,
  type InitiativeState,
  type InitiativeTableMessages,
  type InitiativeTableProps,
} from "./game/initiative-table/InitiativeTable";
export {
  KpiBar,
  KpiBarActions,
  kpiBarVariants,
  type KpiBarActionsProps,
  type KpiBarMessages,
  type KpiBarProps,
  type KpiMetric,
  type KpiRow,
} from "./game/kpi-bar/KpiBar";
export {
  defaultResourceChipMessages,
  ResourceChip,
  ResourceChips,
  resourceChipVariants,
  type ResourceChipMessages,
  type ResourceChipProps,
  type ResourceChipsProps,
  type ResourceKind,
} from "./game/resource-chip/ResourceChip";
export { RoundChip, roundChipVariants, type RoundChipProps } from "./game/round-chip/RoundChip";
export { RoundStarting, roundStartingVariants, type RoundStartingProps } from "./game/round-starting/RoundStarting";

// Data
export {
  DataTable,
  dataTableVariants,
  type DataTableColumn,
  type DataTableMessages,
  type DataTableProps,
  type DataTableSort,
  type SortDirection,
} from "./data/data-table/DataTable";
export { HeatCell, heatBand, heatCellVariants, heatScores, type HeatBand, type HeatCellProps } from "./data/data-table/HeatCell";
export { Figure, Figures, figuresVariants, type FigureProps, type FiguresProps } from "./data/figures/Figures";
export { Pagination, paginationVariants, type PaginationMessages, type PaginationProps } from "./data/pagination/Pagination";
export { pageItems, type PageItem } from "./data/pagination/pages";
export {
  StatementTable,
  statementTableVariants,
  type StatementRow,
  type StatementTableMessages,
  type StatementTableProps,
  type StatementTone,
} from "./data/statement-table/StatementTable";
export { BarChart, barChartVariants, type BarChartMessages, type BarChartProps, type ChartRow } from "./data/chart/BarChart";
export { ChartCard, type ChartCardProps } from "./data/chart/ChartCard";
export { ChartPanel, chartPanelVariants, type ChartPanelProps } from "./data/chart/ChartPanel";
export {
  ComboChart,
  comboChartVariants,
  type ComboChartMessages,
  type ComboChartProps,
  type ComboChartRow,
  type ComboSeries,
} from "./data/chart/ComboChart";
export { DonutChart, donutChartVariants, type DonutChartMessages, type DonutChartProps, type DonutSegment } from "./data/chart/DonutChart";
export {
  HorizontalBarChart,
  horizontalBarChartVariants,
  type HorizontalBarChartMessages,
  type HorizontalBarChartProps,
  type HorizontalChartRow,
} from "./data/chart/HorizontalBarChart";
export { type ChartColor, type ChartSeries } from "./data/chart/series";
export {
  StackedBarChart,
  stackedBarChartVariants,
  type StackedBarChartMessages,
  type StackedBarChartProps,
  type StackedChartRow,
} from "./data/chart/StackedBarChart";
export { evenTicks, niceTicks } from "./data/chart/ticks";
export {
  defaultSlideDeckMessages,
  Slide,
  SlideDeck,
  slideDeckVariants,
  type SlideDeckMessages,
  type SlideDeckProps,
  type SlideProps,
} from "./data/slide-deck/SlideDeck";

// Layout
export { AppShell, type AppShellProps } from "./layout/app-shell/AppShell";
export { PageHeader, type PageHeaderProps } from "./layout/page-header/PageHeader";
export {
  Sidebar,
  SidebarAccount,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarNav,
  SidebarSection,
  SidebarSubItem,
  sidebarVariants,
  type SidebarAccountProps,
  type SidebarHeaderProps,
  type SidebarItemProps,
  type SidebarNavProps,
  type SidebarProps,
  type SidebarSectionProps,
  type SidebarSubItemProps,
} from "./layout/sidebar/Sidebar";
export { useSidebar, type SidebarState } from "./layout/sidebar/SidebarContext";
