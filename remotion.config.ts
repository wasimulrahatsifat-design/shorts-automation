import { Config } from '@remotion/cli/config';

// Universal compatibility for YouTube Shorts, Instagram Reels, and TikTok
Config.setVideoImageFormat('jpeg');
Config.setPixelFormat('yuv420p');
Config.setCrf(18); // Visually lossless encoding
Config.setAudioCodec('aac');
Config.setAudioBitrate('320k');
Config.setVideoBitrate('12M');
