<header class="brand-banner" aria-label="Lapita">
	<div class="brand-lockup">
		<img src="/lapita-logo.png" alt="" class="brand-logo" />
		<span class="font-title text-lapita italic">lapita</span>
	</div>
</header>

<style>
	.brand-banner {
		position: relative;
		display: flex;
		min-height: 12rem;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		background: #262626;
	}
	.brand-banner::before {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--color-lapita);
		clip-path: polygon(0 0, 42% 0, 36% 100%, 0 100%);
	}
	.brand-lockup {
		position: relative;
		display: flex;
		align-items: center;
		gap: 1rem;
		font-size: clamp(3rem, 7vw, 5rem);
		line-height: 1;
	}
	.brand-logo {
		width: 9rem;
		height: 9rem;
		object-fit: contain;
	}
	@media (max-width: 639px) {
		.brand-banner {
			min-height: 8rem;
		}
		.brand-banner::before {
			clip-path: polygon(0 0, 32% 0, 26% 100%, 0 100%);
		}
		.brand-logo {
			width: 5.5rem;
			height: 5.5rem;
		}
		.brand-lockup {
			gap: 0.75rem;
		}
	}
</style>
