// src/routes/api/realtime/+server.js
export async function GET() {
	return new Response(
		new ReadableStream({
			start(controller) {
				// Set up real-time subscription server-side
				const subscription = supabaseServer
					.channel('server-changes')
					.on(
						'postgres_changes',
						{ event: '*', schema: 'public', table: 'grand_prix' },
						(payload) => {
							controller.enqueue(`data: ${JSON.stringify(payload)}\n\n`);
						}
					)
					.subscribe();
			}
		}),
		{
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			}
		}
	);
}
