/* eslint-disable @next/next/no-img-element */

import { ImageResponse } from "next/server";

export const runtime = "edge";
export const preferredRegion = ["iad1"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const title = searchParams.get("title");
  const description = searchParams.get("description");

  const imageData = await fetch(
    new URL("./background.png", import.meta.url)
  ).then((res) => res.arrayBuffer());

  const geistSemibold = await fetch(
    new URL("../../assets/geist-semibold.ttf", import.meta.url)
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(
    (
      <div
        tw="flex h-full w-full bg-black"
        style={{ fontFamily: "Geist Sans" }}
      >
        {/* @ts-expect-error */}
        <img src={imageData} alt="vercel opengraph background" />
        <div tw="flex flex-col absolute h-full w-[750px] justify-center left-[50px] pr-[50px] pt-[116px] pb-[166px]">
          <div
            tw="text-zinc-50 tracking-tight flex-grow-1 flex flex-col justify-center leading-[1.1]"
            style={{
              fontWeight: 500,
              fontSize: 80,
              color: "black",
              letterSpacing: "-0.05em",
            }}
          >
            {title}
          </div>
          <div tw="text-[40px]" style={{ color: "#7D7D7D" }}>
            {description}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 628,
      fonts: [
        {
          name: "geist",
          data: geistSemibold,
          style: "normal",
        },
      ],
    }
  );
}
