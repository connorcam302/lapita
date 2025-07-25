<script>
	// Props for customization
	export let title = 'Your Brand';
	export let subtitle = 'Welcome to our innovative platform where creativity meets functionality';
	export let buttonText = 'Get Started';
	export let leftColor = '#fdcf32';
	export let rightColor = 'oklch(20.5% 0 0)';
	export let height = '24rem'; // 384px equivalent
</script>

<header
	class="diagonal-split hidden w-full items-center justify-center lg:flex"
	style="height: {height}; --left-color: {leftColor}; --right-color: {rightColor};"
>
	<div class="header-content flex items-center gap-4 px-8 text-center">
		<img src="/lapita-logo.png" alt="lapita" class="h-64 w-64" />
		<div class="font-title text-lapita text-9xl italic">lapita</div>
	</div>
</header>

<header
	class="diagonal-split-mobile flex w-full items-center justify-center bg-neutral-900 lg:hidden"
	style="height: 8rem; --left-color: {leftColor}; --right-color: {rightColor};"
>
	<div class="header-content flex items-center gap-4 px-8 text-center">
		<img src="/lapita-logo.png" alt="lapita" class="h-24 w-24" />
		<div class="font-title text-lapita text-6xl italic">lapita</div>
	</div>
</header>

<style>
	.diagonal-split {
		position: relative;
		overflow: hidden;
	}

	.diagonal-split::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 55%;
		height: 100%;
		background-color: var(--left-color);
		clip-path: polygon(0 0, 78.5% 0, 70% 100%, 0 100%);
		z-index: 1;
	}

	.diagonal-split::after {
		content: '';
		position: absolute;
		top: 0;
		right: 0;
		width: 100%;
		height: 100%;
		background-color: var(--right-color);
		z-index: 0;
	}

	.header-content {
		position: relative;
		z-index: 10;
	}

	.diagonal-split-mobile {
		position: relative;
		overflow: hidden;
	}

	.diagonal-split-mobile::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 40%;
		height: 100%;
		background-color: var(--left-color);
		clip-path: polygon(0 0, 78.5% 0, 70% 100%, 0 100%);
		z-index: 1;
	}

	.diagonal-split-mobile::after {
		content: '';
		position: absolute;
		top: 0;
		right: 0;
		width: 100%;
		height: 100%;
		background-color: var(--right-color);
		z-index: 0;
	}

	.header-content {
		position: relative;
		z-index: 10;
	}
</style>
