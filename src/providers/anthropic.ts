import Anthropic from "@anthropic-ai/sdk";


// export function anthropicProvider() {

//     return { model,

//         const anthorpic = new Anthropic();
    
//     const stream = anthorpic.messages.stream({
//       model: values.model,
//       max_tokens: 1024,
//       messages: [{ role: "user", content: values.prompt }],
//     });
    
//     for await (const event of stream) {
//         if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
//             process.stdout.write(event.delta.text)
//         }
//     }
    
//     const message = await stream.finalMessage();}
// }