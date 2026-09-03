// Typed asset map. The browser URL-encodes special characters (spaces, &, :, em-dash)
// in folder names automatically when we reference them as URL strings, so we keep
// the existing folder structure and rely on this map for type-safe lookups.

const enc = (s: string) => s.split('/').map(encodeURIComponent).join('/');

/**
 * A URL for a file in publicDir, resolved against the app's base.
 *
 * A leading '/' asks for the file at the root of whatever host serves the page.
 * That is fine when the app owns the root, and wrong the moment it is mounted
 * under a path — every image 404s, or worse, arrives from whatever application
 * does own the root and happens to have a file by that name.
 *
 * BASE_URL is '/' for a normal build, so this changes nothing today; with
 * `vite build --base=./` it resolves relative to the page instead.
 */
export const assetUrl = (path: string) =>
  `${import.meta.env.BASE_URL}${enc(path).replace(/^\//, '')}`;

const i = (path: string) => assetUrl(path);

export const A = {
  logo: i('img/logo.png'),

  mascot: {
    base: {
      idle: i('img/mascot/01_base/final-approved/mascot_base_idle_v01.png'),
      idle2: i('img/mascot/01_base/final-approved/mascot_base_idle2_v01.png'),
      front: i('img/mascot/01_base/final-approved/mascot_base_front_v01.png'),
      threeQtr: i('img/mascot/01_base/final-approved/mascot_base_3qtr_v01.png'),
      // Talking-head frames (square 1254×1254): open + closed mouth, used by
      // MascotAvatar to lip-flap and react on hover.
      talkOpen: i('img/mascot/01_base/alt-versions/mascot_base_brighter-expression_v01.png'),
      talkClosed: i('img/mascot/01_base/alt-versions/mascot_base_clean-neutral_v01.png'),
    },
    expressions: {
      neutral: i('img/mascot/02_expressions/mascot_neutral_v01.png'),
      happy: i('img/mascot/02_expressions/mascot_happy_v01.png'),
      happy_soft: i('img/mascot/02_expressions/mascot_happy_soft_v01.png'),
      excited: i('img/mascot/02_expressions/mascot_excited_v01.png'),
      excited_big: i('img/mascot/02_expressions/mascot_excited_big_v01.png'),
      thinking: i('img/mascot/02_expressions/mascot_thinking_v01.png'),
      thinking_side: i('img/mascot/02_expressions/mascot_thinking_side_v01.png'),
      concerned: i('img/mascot/02_expressions/mascot_concerned_v01.png'),
      concerned_soft: i('img/mascot/02_expressions/mascot_concerned_soft_v01.png'),
      confused: i('img/mascot/02_expressions/mascot_confused_v01.png'),
      confused_tilt: i('img/mascot/02_expressions/mascot_confused_tilt_v01.png'),
      warning: i('img/mascot/02_expressions/mascot_warning_v01.png'),
      warning_alert: i('img/mascot/02_expressions/mascot_warning_alert_v01.png'),
    },
    poses: {
      idle_stand: i('img/mascot/03_poses/mascot_idle_stand_v01.png'),
      idle_soft_wave: i('img/mascot/03_poses/mascot_idle_soft-wave_v01.png'),
      pointing_left: i('img/mascot/03_poses/mascot_pointing_left_v01.png'),
      pointing_left_explain: i('img/mascot/03_poses/mascot_pointing_left_explain_v01.png'),
      pointing_right: i('img/mascot/03_poses/mascot_pointing_right_v01.png'),
      pointing_right_explain: i('img/mascot/03_poses/mascot_pointing_right_explain_v01.png'),
      presenting: i('img/mascot/03_poses/mascot_presenting_v01.png'),
      presenting_open_hand: i('img/mascot/03_poses/mascot_presenting_open-hand_v01.png'),
    },
  },

  // NOTE: notebook cover art is deliberately NOT mapped here. It lives at
  // `assets/img/notebooks/<genreId>.png` and is resolved by `genreArt()` in
  // engine/finlit/core/config/genres.ts, so publishing a new notebook never
  // requires editing this file. The map below is the legacy V2 archetype art.
  notebook: {
    student: {
      hardcover_ring: i('img/notebook-core/student/student_angle_hardcover-ring_v01.png'),
      hardcover_staple: i('img/notebook-core/student/student_angle_hardcover-staple_v01.png'),
      leather_ring: i('img/notebook-core/student/student_angle_leather-ring_v01.png'),
      leather_staple: i('img/notebook-core/student/student_angle_leather-staple_v01.png'),
      view: {
        front: i('img/notebook-core/student/angle-view/front_default_v01.png'),
        angle: i('img/notebook-core/student/angle-view/angle_default_v01.png'),
        spine: i('img/notebook-core/student/angle-view/spine_default_v01.png'),
        open: i('img/notebook-core/student/angle-view/open_default_v01.png'),
        shelf: i('img/notebook-core/student/angle-view/shelf_default_v01.png'),
      },
    },
    planner: {
      hardcover_ring: i('img/notebook-core/planner/planner_angle_hardcover-ring_v01.png'),
      hardcover_staple: i('img/notebook-core/planner/planner_angle_hardcover-staple_v01.png'),
      leather_ring: i('img/notebook-core/planner/planner_angle_leather-ring_v01.png'),
      leather_staple: i('img/notebook-core/planner/planner_angle_leather-staple_v01.png'),
      view: {
        front: i('img/notebook-core/planner/angle-view/front_default_v01.png'),
        angle: i('img/notebook-core/planner/angle-view/angle_default_v01.png'),
        spine: i('img/notebook-core/planner/angle-view/spine_default_v01.png'),
        open: i('img/notebook-core/planner/angle-view/open_default_v01.png'),
        shelf: i('img/notebook-core/planner/angle-view/shelf_default_v01.png'),
      },
    },
    daily: {
      hardcover_ring: i('img/notebook-core/daily/daily_angle_hardcover-ring_v01.png'),
      hardcover_staple: i('img/notebook-core/daily/daily_angle_hardcover-staple_v01.png'),
      leather_ring: i('img/notebook-core/daily/daily_angle_leather-ring_v01.png'),
      leather_staple: i('img/notebook-core/daily/daily_angle_leather-staple_v01.png'),
      view: {
        front: i('img/notebook-core/daily/angle-view/front_default_v01.png'),
        angle: i('img/notebook-core/daily/angle-view/angle_default_v01.png'),
        spine: i('img/notebook-core/daily/angle-view/spine_default_v01.png'),
        open: i('img/notebook-core/daily/angle-view/open_default_v01.png'),
        shelf: i('img/notebook-core/daily/angle-view/shelf_default_v01.png'),
      },
    },
  },

  env: {
    desk: i('img/environment/desk_bg_main_isometric_clean_v02.png'),
    deskFull: i('img/environment/desk_bg_main_isometric_v01.png'),
    studio: i('img/environment/studio_bg_operations_v01.png'),
    shelf: i('img/environment/shelf_bg_portfolio_isometric_v01.png'),
    desk_shadow: i('img/environment/desk_shadow_notebook_angle_v01.png'),
    round1: i('img/environment/round_bg_launch_v01.png'),
    round2: i('img/environment/round_bg_peak_demand_v01.png'),
    round3: i('img/environment/round_bg_premium_season_v01.png'),
    round4: i('img/environment/round_bg_ops_pressure_v01.png'),
    // Pass Key gate backdrop still — the storefront scene (first frame of the
    // loop video). Shows instantly and is the video's poster / fallback
    // (see components/passkey/VideoBackdrop).
    passkeyPoster: i('img/environment/pixelenterpin-background.png'),
  },

  // Looping background video for the Pass Key gate. VideoBackdrop crossfades
  // this in over the poster once buffered, and falls back to the poster on
  // reduced-motion / error.
  video: {
    passkeyBg: i('img/environment/pixelenterpin-background-loop_v02.mp4'),
  },

  addons: {
    integrated: {
      charm_bear: i('img/add-ons/integrated/charm_mascot_bear.png'),
      charm_penguin: i('img/add-ons/integrated/charm_mascot_penguin.png'),
      charm_dino: i('img/add-ons/integrated/charm_mascot_dino.png'),
      charm_cat: i('img/add-ons/integrated/charm_mascot_cat.png'),
      ribbon_red: i('img/add-ons/integrated/ribbon_wrap_red.png'),
      ribbon_pink: i('img/add-ons/integrated/ribbon_wrap_pink.png'),
      sticker_name: i('img/add-ons/integrated/sticker-name.png'),
      sticker_basic: i('img/add-ons/integrated/sticker_pack_basic.png'),
      sticker_cute: i('img/add-ons/integrated/sticker_pack_cute.png'),
    },
    decorative: {
      sticker_bundle: i('img/add-ons/decorative-bundles/sticker_bundle_large.png'),
      washi: i('img/add-ons/decorative-bundles/washi_tape_set.png'),
      cover_wrap: i('img/add-ons/decorative-bundles/themed_cover_wrap.png'),
      pattern: i('img/add-ons/decorative-bundles/pattern_overlay_pack.png'),
    },
    functional: {
      bookmark: i('img/add-ons/functional-utilities/bookmark_ribbon.png'),
      band: i('img/add-ons/functional-utilities/elastic_band.png'),
      closure: i('img/add-ons/functional-utilities/magnetic_closure.png'),
      clip: i('img/add-ons/functional-utilities/removable_clip.png'),
    },
    organization: {
      habit: i('img/add-ons/organization-inserts/habit_tracker_pack.png'),
      meeting: i('img/add-ons/organization-inserts/meeting_notes_pack.png'),
      planner: i('img/add-ons/organization-inserts/planner_insert_set.png'),
      sketch: i('img/add-ons/organization-inserts/sketch_pack.png'),
    },
    writing: {
      basic_pen: i('img/add-ons/writing-tools/basic_pen.png'),
      premium_pen: i('img/add-ons/writing-tools/premium_pen.png'),
      mech_pencil: i('img/add-ons/writing-tools/mechanical_pencil.png'),
      highlighters: i('img/add-ons/writing-tools/highlighter_set.png'),
    },
    badge: {
      premium: i('img/add-ons/logic only - backend impact/premium_upgrade.png'),
      cost_reduction: i('img/add-ons/logic only - backend impact/cost_reduction_upgrade.png'),
      production_speed: i('img/add-ons/logic only - backend impact/production_speed_upgrade.png'),
      demand_boost: i('img/add-ons/logic only - backend impact/demand_boost_pack.png'),
    },
  },

  ui: {
    sidebar: {
      product: i('img/ui/Main Sidebar Category Icons/icon_product_core_v01.png'),
      cover_style: i('img/ui/Main Sidebar Category Icons/icon_cover_style_v01.png'),
      material: i('img/ui/Main Sidebar Category Icons/icon_material_v01.png'),
      addons: i('img/ui/Main Sidebar Category Icons/icon_addons_v01.png'),
      studio: i('img/ui/Main Sidebar Category Icons/icon_studio_operations_v01.png'),
      commercial: i('img/ui/Main Sidebar Category Icons/icon_commercial_v01.png'),
      metrics: i('img/ui/Main Sidebar Category Icons/icon_metrics_dashboard_v01.png'),
      results: i('img/ui/Main Sidebar Category Icons/icon_results_v01.png'),
    },
    metrics: {
      revenue: i('img/ui/Main Business Metric Icons/icon_revenue_v01.png'),
      profit: i('img/ui/Main Business Metric Icons/icon_profit_v01.png'),
      inventory: i('img/ui/Main Business Metric Icons/icon_inventory_v01.png'),
      demand: i('img/ui/Main Business Metric Icons/icon_demand_v01.png'),
      capacity: i('img/ui/Main Business Metric Icons/icon_capacity_v01.png'),
      quality: i('img/ui/Main Business Metric Icons/icon_quality_v01.png'),
      defect_rate: i('img/ui/Main Business Metric Icons/icon_defect_rate_v01.png'),
      on_time_delivery: i('img/ui/Main Business Metric Icons/icon_on_time_delivery_v01.png'),
    },
    segment: {
      students: i('img/ui/Customer Segment Icons/icon_segment_students_v01.png'),
      creators: i('img/ui/Customer Segment Icons/icon_segment_creators_v01.png'),
      professionals: i('img/ui/Customer Segment Icons/icon_segment_professionals_v01.png'),
      gift: i('img/ui/Customer Segment Icons/icon_segment_gift_buyers_v01.png'),
    },
    pnl: {
      gross_revenue: i('img/ui/PnL Finance Icons/icon_gross_revenue_v01.png'),
      net_revenue: i('img/ui/PnL Finance Icons/icon_net_revenue_v01.png'),
      operating_profit: i('img/ui/PnL Finance Icons/icon_operating_profit_v01.png'),
      material_cost: i('img/ui/PnL Finance Icons/icon_material_cost_v01.png'),
      labor_cost: i('img/ui/PnL Finance Icons/icon_labor_cost_v01.png'),
      marketing_spend: i('img/ui/PnL Finance Icons/icon_marketing_spend_v01.png'),
      packaging_cost: i('img/ui/PnL Finance Icons/icon_packaging_cost_v01.png'),
      fulfillment_cost: i('img/ui/PnL Finance Icons/icon_fulfillment_cost_v01.png'),
    },
    nav: {
      confirm: i('img/ui/Navigation View Buttons/btn_confirm_decision_v01.png'),
      save: i('img/ui/Navigation View Buttons/btn_save_decision_v01.png'),
      next_round: i('img/ui/Navigation View Buttons/btn_next_round_v01.png'),
      next_notebook: i('img/ui/Navigation View Buttons/btn_next_notebook_v01.png'),
      previous_notebook: i('img/ui/Navigation View Buttons/btn_previous_notebook_v01.png'),
      undo: i('img/ui/Navigation View Buttons/btn_undo_v01.png'),
      reset: i('img/ui/Navigation View Buttons/btn_reset_selection_v01.png'),
      close: i('img/ui/Navigation View Buttons/btn_close_v01.png'),
      help: i('img/ui/Navigation View Buttons/btn_help_v01.png'),
      info: i('img/ui/Navigation View Buttons/btn_info_v01.png'),
      desk_view: i('img/ui/Navigation View Buttons/btn_desk_view_v01.png'),
      shelf_view: i('img/ui/Navigation View Buttons/btn_shelf_view_v01.png'),
    },
    // Small square glyphs cropped from master-style/icon-style-reference_v01
    // (transparent bg, ~36-50px, pixel-crisp). Unlike the `nav` buttons above
    // these are pure icons — safe to render at 13-22px with `pixelated`.
    pixel: {
      arrow_left: i('img/ui/pixel-icons/arrow_left.png'),
      arrow_right: i('img/ui/pixel-icons/arrow_right.png'),
      info: i('img/ui/pixel-icons/info.png'),
      notebook_focus: i('img/ui/pixel-icons/notebook_focus.png'),
      grid_shelf: i('img/ui/pixel-icons/grid_shelf.png'),
      trophy: i('img/ui/pixel-icons/trophy.png'),
      // celebration set (final results): gold star, sparkle cluster, gift box
      star: i('img/ui/pixel-icons/star.png'),
      sparkles: i('img/ui/pixel-icons/sparkles.png'),
      gift: i('img/ui/pixel-icons/gift.png'),
    },
    // Heart + sparkle sprites for the pat-Amelia love bomb (components/fx/HeartRain).
    lovebomb: {
      red: i('img/lovebomb/love-red.png'),
      yellow: i('img/lovebomb/love-yellow.png'),
      pink: i('img/lovebomb/love-pink.png'),
      blue: i('img/lovebomb/love-blue.png'),
      sparkle: i('img/lovebomb/sparkle-1.png'),
    },
    config: {
      notebook_type: i('img/ui/Product Configuration Icons/icon_notebook_type_v01.png'),
      notebook_size: i('img/ui/Product Configuration Icons/icon_notebook_size_v01.png'),
      page_count: i('img/ui/Product Configuration Icons/icon_page_count_v01.png'),
      paper_quality: i('img/ui/Product Configuration Icons/icon_paper_quality_v01.png'),
      cover_material: i('img/ui/Product Configuration Icons/icon_cover_material_v01.png'),
      binding: i('img/ui/Product Configuration Icons/icon_binding_v01.png'),
      packaging: i('img/ui/Product Configuration Icons/icon_packaging_v01.png'),
      bundle: i('img/ui/Product Configuration Icons/icon_bundle_v01.png'),
    },
    commercial: {
      pricing: i('img/ui/Commercial Marketing Icons/icon_pricing_v01.png'),
      campaign: i('img/ui/Commercial Marketing Icons/icon_campaign_v01.png'),
      bulk_order: i('img/ui/Commercial Marketing Icons/icon_bulk_order_v01.png'),
      discount: i('img/ui/Commercial Marketing Icons/icon_discount_v01.png'),
      influencer: i('img/ui/Commercial Marketing Icons/icon_influencer_v01.png'),
      limited_drop: i('img/ui/Commercial Marketing Icons/icon_limited_drop_v01.png'),
      loyalty: i('img/ui/Commercial Marketing Icons/icon_loyalty_v01.png'),
      social_media: i('img/ui/Commercial Marketing Icons/icon_social_media_v01.png'),
    },
    studioOps: {
      supplier: i('img/ui/Studio Operations Icons/icon_supplier_v01.png'),
      staff_training: i('img/ui/Studio Operations Icons/icon_staff_training_v01.png'),
      inventory_shelf: i('img/ui/Studio Operations Icons/icon_inventory_shelf_v01.png'),
      printing: i('img/ui/Studio Operations Icons/icon_printing_machine_v01.png'),
      binding_machine: i('img/ui/Studio Operations Icons/icon_binding_machine_v01.png'),
      cutting: i('img/ui/Studio Operations Icons/icon_cutting_machine_v01.png'),
      packaging_station: i('img/ui/Studio Operations Icons/icon_packaging_station_v01.png'),
      quality_check: i('img/ui/Studio Operations Icons/icon_quality_check_v01.png'),
    },
    addonThumb: {
      bookmark_ribbon: i('img/ui/Add-on Icons/icon_bookmark_ribbon_v01.png'),
      custom_name: i('img/ui/Add-on Icons/icon_custom_name_print_v01.png'),
      divider_tabs: i('img/ui/Add-on Icons/icon_divider_tabs_v01.png'),
      elastic_band: i('img/ui/Add-on Icons/icon_elastic_band_v01.png'),
      gift_sleeve: i('img/ui/Add-on Icons/icon_gift_sleeve_v01.png'),
      inner_pocket: i('img/ui/Add-on Icons/icon_inner_pocket_v01.png'),
      pen: i('img/ui/Add-on Icons/icon_pen_addon_v01.png'),
      sticker: i('img/ui/Add-on Icons/icon_sticker_addon_v01.png'),
    },
  },
} as const;

export type AssetMap = typeof A;
