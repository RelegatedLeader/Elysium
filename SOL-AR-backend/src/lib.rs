use anchor_lang::prelude::*;

declare_id!("9qTuVAyYyTuoLTWSRLXmrbQycKKbAMCjwFhUV9LPSMdR");

#[program]
pub mod elysium_program {
    use super::*;

    pub fn initialize_note(ctx: Context<InitializeNote>, note_id: u64, arweave_hash: String, timestamp: i64) -> Result<()> {
        let note_account = &mut ctx.accounts.note_account;
        note_account.owner = *ctx.accounts.user.key;
        note_account.note_id = note_id;
        note_account.arweave_hash = arweave_hash;
        note_account.timestamp = timestamp;
        note_account.is_permanent = false;
        Ok(())
    }

    pub fn set_permanent(ctx: Context<SetPermanent>, note_id: u64) -> Result<()> {
        let note_account = &mut ctx.accounts.note_account;
        require!(note_account.note_id == note_id, ErrorCode::InvalidNoteId);
        note_account.is_permanent = true;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeNote<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 8 + 64 + 8 + 1,
        seeds = [b"note", user.key.as_ref(), note_id.to_le_bytes().as_ref()],
        bump
    )]
    pub note_account: Account<'info, NoteAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPermanent<'info> {
    #[account(
        mut,
        seeds = [b"note", user.key.as_ref(), note_id.to_le_bytes().as_ref()],
        bump
    )]
    pub note_account: Account<'info, NoteAccount>,
    pub user: Signer<'info>,
}

#[account]
pub struct NoteAccount {
    pub owner: Pubkey,
    pub note_id: u64,
    pub arweave_hash: String,
    pub timestamp: i64,
    pub is_permanent: bool,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid note ID")]
    InvalidNoteId,
}