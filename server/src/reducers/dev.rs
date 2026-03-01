use spacetimedb::{reducer, ReducerContext, Table};
use crate::tables::*;

/// Dev/admin utility — wipes all user_profile and clerk_identity_map rows.
/// Security relies on SPACETIMEDB_SERVER_TOKEN being kept secret.
#[reducer]
pub fn dev_clear_all_users(ctx: &ReducerContext) -> Result<(), String> {
    let identities: Vec<String> = ctx
        .db
        .user_profile()
        .iter()
        .map(|u| u.identity.clone())
        .collect();

    for id in identities {
        ctx.db.user_profile().identity().delete(id);
    }

    let clerk_ids: Vec<String> = ctx
        .db
        .clerk_identity_map()
        .iter()
        .map(|m| m.clerk_user_id.clone())
        .collect();

    for id in clerk_ids {
        ctx.db.clerk_identity_map().clerk_user_id().delete(id);
    }

    log::info!("[dev] All user profiles cleared");
    Ok(())
}
