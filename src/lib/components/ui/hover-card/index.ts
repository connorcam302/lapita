import { LinkPreview as HoverCardPrimitive } from 'bits-ui';
import Trigger from './hover-card-trigger.svelte';
import Content from './hover-card-content.svelte';

const Root = HoverCardPrimitive.Root;
const Portal = HoverCardPrimitive.Portal;

export {
	Root,
	Trigger,
	Content,
	Portal,
	Root as HoverCard,
	Trigger as HoverCardTrigger,
	Content as HoverCardContent,
	Portal as HoverCardPortal
};
