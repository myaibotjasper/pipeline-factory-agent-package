import type { RobotSpec } from './RobotController';

export const ROBOT_SPECS: RobotSpec[] = [
  {
    id: 'scanner_bot',
    role: 'Ingestion',
    home_zone: 'RECEIVING_DOCK',
    rig: 'robot_base_rig_v1',
    variant: { head: 'round_led', prop: 'tablet_scanner' },
    clips: {
      idle: 'scanner_idle_loop',
      work: 'scan_and_stamp_loop',
      success: 'happy_beep',
      failure: 'confused_shrug',
    },
  },
  {
    id: 'architect_bot',
    role: 'Planning',
    home_zone: 'BLUEPRINT_LOFT',
    rig: 'robot_base_rig_v1',
    variant: { head: 'visor_led', prop: 'holo_projector' },
    clips: {
      idle: 'holo_idle_loop',
      work: 'arrange_blueprints_loop',
      success: 'approve_stamp',
      failure: 'reject_stamp',
    },
  },
  {
    id: 'builder_bot',
    role: 'Engineering',
    home_zone: 'ASSEMBLY_LINE',
    count: 6,
    rig: 'robot_base_rig_v1',
    variant: { head: 'square_led', prop: 'welder_tool' },
    clips: {
      idle: 'tool_idle_loop',
      work: 'weld_loop',
      success: 'tiny_dance',
      failure: 'sparks_oops',
    },
  },
  {
    id: 'inspector_bot',
    role: 'QA',
    home_zone: 'QA_GATE',
    rig: 'robot_base_rig_v1',
    variant: { head: 'mono_eye', prop: 'scanner_beam' },
    clips: {
      idle: 'inspect_idle_loop',
      work: 'scan_loop',
      success: 'green_check_pose',
      failure: 'red_buzzer_pose',
    },
  },
  {
    id: 'pilot_bot',
    role: 'Release',
    home_zone: 'LAUNCH_BAY',
    rig: 'robot_base_rig_v1',
    variant: { head: 'antenna', prop: 'launch_lever' },
    clips: {
      idle: 'pilot_idle_loop',
      work: 'countdown_and_launch',
      success: 'salute',
      failure: 'retry_panicked',
    },
  },
  {
    id: 'foreman_bot',
    role: 'Orchestrator',
    home_zone: 'CONTROL_ROOM',
    rig: 'robot_base_rig_v1',
    variant: { head: 'boss_crown_led', prop: 'pointer_baton' },
    clips: {
      idle: 'foreman_idle_loop',
      work: 'point_and_direct',
      success: 'thumbs_up_big',
      failure: 'siren_mode_pose',
    },
  },
];
