/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode:true,
    images:{    
        remotePatterns:[
            {
                protocol:"https",
                hostname:"replicate.com",
            },
            {
                protocol:"https",
                hostname:"replicate.delivery",
            },
            {
                protocol:"https",
                hostname:"tokensceshi.oss-ap-southeast-1.aliyuncs.com",
            }
        ]
    }
};

export default nextConfig;
