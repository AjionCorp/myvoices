use spacetimedb::{reducer, ReducerContext, Table};
use crate::tables::*;

const GRID_COLS: i32 = 1250;
const GRID_ROWS: i32 = 800;
const CENTER_X: i32 = GRID_COLS / 2;
const CENTER_Y: i32 = GRID_ROWS / 2;

const AD_RING_DISTANCES: &[i32] = &[4, 8, 13, 19, 26, 34, 43, 53, 64, 76];
const AD_EDGE_SPACING: i32 = 3;

fn is_ad_slot(col: i32, row: i32) -> bool {
    for &d in AD_RING_DISTANCES {
        if (col == CENTER_X - d || col == CENTER_X + d)
            && (row == CENTER_Y - d || row == CENTER_Y + d)
        {
            return true;
        }
        if row == CENTER_Y - d || row == CENTER_Y + d {
            let dx = col - CENTER_X;
            if dx > -d + AD_EDGE_SPACING
                && dx < d - AD_EDGE_SPACING + 1
                && (dx + d - AD_EDGE_SPACING) % AD_EDGE_SPACING == 0
            {
                return true;
            }
        }
        if col == CENTER_X - d || col == CENTER_X + d {
            let dy = row - CENTER_Y;
            if dy > -d + AD_EDGE_SPACING
                && dy < d - AD_EDGE_SPACING + 1
                && (dy + d - AD_EDGE_SPACING) % AD_EDGE_SPACING == 0
            {
                return true;
            }
        }
    }
    false
}

fn spiral_coord_skip_ads(index: usize) -> (i32, i32) {
    let mut x: i32 = 0;
    let mut y: i32 = 0;
    let mut dx: i32 = 1;
    let mut dy: i32 = 0;
    let mut segment_length: usize = 1;
    let mut segment_passed: usize = 0;
    let mut turns_made: usize = 0;

    let cx = CENTER_X;
    let cy = CENTER_Y;

    let mut placed = 0usize;
    if !is_ad_slot(cx, cy) {
        if placed == index {
            return (cx, cy);
        }
        placed += 1;
    }

    for _ in 0..2_000_000usize {
        x += dx;
        y += dy;
        segment_passed += 1;

        if segment_passed == segment_length {
            segment_passed = 0;
            let temp = dx;
            dx = -dy;
            dy = temp;
            turns_made += 1;
            if turns_made % 2 == 0 {
                segment_length += 1;
            }
        }

        let abs_x = cx + x;
        let abs_y = cy + y;
        if abs_x < 0 || abs_x >= GRID_COLS || abs_y < 0 || abs_y >= GRID_ROWS {
            continue;
        }
        if is_ad_slot(abs_x, abs_y) {
            continue;
        }
        if placed == index {
            return (abs_x, abs_y);
        }
        placed += 1;
    }

    (cx, cy)
}

#[reducer]
pub fn rebalance_layout(ctx: &ReducerContext, batch_size: u32) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();
    let user = ctx.db.user_profile().identity().find(caller);
    if !user.map(|u| u.is_admin).unwrap_or(false) {
        return Err("Only admins can trigger rebalance".to_string());
    }

    let mut claimed_blocks: Vec<Block> = ctx
        .db
        .block()
        .iter()
        .filter(|b| b.status == "claimed")
        .collect();

    claimed_blocks.sort_by(|a, b| {
        let score_a = (a.likes as i64) - (a.dislikes as i64);
        let score_b = (b.likes as i64) - (b.dislikes as i64);
        score_b.cmp(&score_a)
    });

    let limit = (batch_size as usize).min(claimed_blocks.len());
    for (i, block) in claimed_blocks.iter().take(limit).enumerate() {
        let (new_x, new_y) = spiral_coord_skip_ads(i);
        if block.x != new_x || block.y != new_y {
            ctx.db.block().id().delete(block.id);
            ctx.db.block().try_insert(Block {
                x: new_x,
                y: new_y,
                ..block.clone()
            }).map_err(|e| format!("Insert failed: {e}"))?;
        }
    }

    log::info!("Rebalanced {} blocks by net score", limit);
    Ok(())
}
