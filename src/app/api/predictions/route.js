import{NextResponse }from"next/server";
import Replicate from "replicate";

const replicate =new Replicate({
    auth:process.env.REPLICATE_API_TOKEN,
});


// In production and preview deployments (on Vercel), the VERcEL URL environment variableis set.
//In development (on your local machine),the NGRoK HoST environment variable is set.
const WEBHOOK_HOST = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NGROK_HOST;

export async function POST(request) {
    if(!process.env.REPLICATE_API_TOKEN){
        throw new Error(
            'The REPLICATE API TOKEN environment variable is not set. See README.md forinstructions on how to set it.'
        );
    }
    const{ prompt } =await request.json();
    const options = {
        model: 'black-forest-labs/flux-schnell',
        input: {prompt}
    }
    if(WEBHOOK_HOST){
        options.webhook = `${WEBHOOK_HOST}/api/predictions/api/webhook`
        options.webhook_events_filter = ["start", "completed"]
    }
    const prediction = await replicate.predictions.create(options);

    if(prediction?.error){
        return NextResponse.json({error:prediction.error}, {status:500})
    }

    return NextResponse.json(prediction,{status:201});
}
