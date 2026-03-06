use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("HDvUruses5D2tPCUZnhkLiR4GB2B49GwkpjJJUKjCAvw");

/// Maximum vouch amount: 5 SOL (matches client-side BoostModal cap)
const MAX_VOUCH_LAMPORTS: u64 = 5_000_000_000;

/// Maximum allowed clock drift for photo timestamps (5 minutes)
const MAX_TIMESTAMP_DRIFT_SECONDS: i64 = 300;

#[program]
pub mod candor_program {
    use super::*;

    /// Record a verified photo on-chain.
    /// Creates a PhotoRecord PDA seeded by [b"photo", creator, image_hash].
    pub fn verify_photo(
        ctx: Context<VerifyPhoto>,
        image_hash: [u8; 32],
        latitude: i64,   // Fixed-point: actual * 1e7
        longitude: i64,  // Fixed-point: actual * 1e7
        timestamp: i64,
    ) -> Result<()> {
        // Validate timestamp is within ±5 minutes of cluster clock
        let clock = Clock::get()?;
        let drift = (timestamp - clock.unix_timestamp).abs();
        require!(
            drift <= MAX_TIMESTAMP_DRIFT_SECONDS,
            CandorError::TimestampOutOfRange
        );

        let photo = &mut ctx.accounts.photo_record;
        photo.creator = ctx.accounts.creator.key();
        photo.image_hash = image_hash;
        photo.latitude = latitude;
        photo.longitude = longitude;
        photo.timestamp = timestamp;
        photo.vouch_count = 0;
        photo.total_earned = 0;
        photo.bump = ctx.bumps.photo_record;

        msg!("Photo verified: creator={}, hash={:?}", photo.creator, &image_hash[..4]);
        Ok(())
    }

    /// Vouch for a photo by sending SOL directly to the creator.
    /// Creates a VouchRecord PDA seeded by [b"vouch", voucher, photo_record].
    /// One vouch per user per photo (enforced by PDA uniqueness).
    pub fn vouch(ctx: Context<Vouch>, amount: u64) -> Result<()> {
        require!(amount > 0, CandorError::InvalidAmount);
        require!(amount <= MAX_VOUCH_LAMPORTS, CandorError::AmountExceedsMax);
        require!(
            ctx.accounts.voucher.key() != ctx.accounts.photo_record.creator,
            CandorError::CannotVouchOwnPhoto
        );

        // Capture keys before mutable borrows
        let voucher_key = ctx.accounts.voucher.key();
        let photo_record_key = ctx.accounts.photo_record.key();
        let creator_key = ctx.accounts.photo_record.creator;

        // Transfer SOL from voucher to creator
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.voucher.to_account_info(),
                to: ctx.accounts.creator.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, amount)?;

        // Update photo record
        let photo = &mut ctx.accounts.photo_record;
        photo.vouch_count = photo
            .vouch_count
            .checked_add(1)
            .ok_or(CandorError::Overflow)?;
        photo.total_earned = photo
            .total_earned
            .checked_add(amount)
            .ok_or(CandorError::Overflow)?;

        // Initialize vouch record
        let vouch_record = &mut ctx.accounts.vouch_record;
        vouch_record.voucher = voucher_key;
        vouch_record.photo_record = photo_record_key;
        vouch_record.amount = amount;
        vouch_record.timestamp = Clock::get()?.unix_timestamp;
        vouch_record.bump = ctx.bumps.vouch_record;

        msg!(
            "Vouch: {} lamports from {} for photo by {}",
            amount,
            voucher_key,
            creator_key
        );
        Ok(())
    }
}

// ─── Accounts ────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(image_hash: [u8; 32])]
pub struct VerifyPhoto<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + PhotoRecord::INIT_SPACE,
        seeds = [b"photo", creator.key().as_ref(), image_hash.as_ref()],
        bump
    )]
    pub photo_record: Account<'info, PhotoRecord>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Vouch<'info> {
    #[account(
        init,
        payer = voucher,
        space = 8 + VouchRecord::INIT_SPACE,
        seeds = [b"vouch", voucher.key().as_ref(), photo_record.key().as_ref()],
        bump
    )]
    pub vouch_record: Account<'info, VouchRecord>,

    #[account(
        mut,
        has_one = creator @ CandorError::InvalidCreator,
    )]
    pub photo_record: Account<'info, PhotoRecord>,

    #[account(mut)]
    pub voucher: Signer<'info>,

    /// CHECK: Validated via photo_record.creator constraint
    #[account(mut)]
    pub creator: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

// ─── State ───────────────────────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct PhotoRecord {
    pub creator: Pubkey,       // 32
    pub image_hash: [u8; 32],  // 32
    pub latitude: i64,         // 8
    pub longitude: i64,        // 8
    pub timestamp: i64,        // 8
    pub vouch_count: u64,      // 8
    pub total_earned: u64,     // 8
    pub bump: u8,              // 1
}
// Total: 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 = 105 bytes + 8 discriminator = 113

#[account]
#[derive(InitSpace)]
pub struct VouchRecord {
    pub voucher: Pubkey,       // 32
    pub photo_record: Pubkey,  // 32
    pub amount: u64,           // 8
    pub timestamp: i64,        // 8
    pub bump: u8,              // 1
}
// Total: 32 + 32 + 8 + 8 + 1 = 81 bytes + 8 discriminator = 89

// ─── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum CandorError {
    #[msg("Vouch amount must be greater than zero")]
    InvalidAmount,
    #[msg("Vouch amount exceeds maximum of 5 SOL")]
    AmountExceedsMax,
    #[msg("Cannot vouch for your own photo")]
    CannotVouchOwnPhoto,
    #[msg("Invalid creator account")]
    InvalidCreator,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Timestamp is too far from current cluster time (max ±5 minutes)")]
    TimestampOutOfRange,
}
