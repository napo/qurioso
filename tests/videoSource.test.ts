import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMO_VIDEO_URL, resolveVideoSource, videoUrlError, parseVideoUrl } from '../src/utils/videoSource';

test('legacy demo links saved in quizzes are replaced, custom links are preserved', () => {
  assert.equal(resolveVideoSource('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'), DEMO_VIDEO_URL);
  assert.equal(resolveVideoSource('https://example.org/lesson.webm'), 'https://example.org/lesson.webm');
});

test('YouTube, Vimeo and direct video links are parsed; invalid links are rejected', () => {
  assert.equal(videoUrlError('https://example.org/video.mp4'), null);
  assert.equal(videoUrlError('https://example.org/download?id=123'), null);
  assert.equal(parseVideoUrl('https://youtu.be/M7lc1UVf-VE?t=10').provider, 'youtube');
  assert.equal(parseVideoUrl('https://www.youtube.com/shorts/M7lc1UVf-VE').url, 'https://www.youtube.com/watch?v=M7lc1UVf-VE');
  assert.equal(parseVideoUrl('https://player.vimeo.com/video/76979871?h=abc123').url, 'https://vimeo.com/76979871?h=abc123');
  assert.equal(parseVideoUrl('https://vimeo.com/76979871/abc123').url, 'https://vimeo.com/76979871?h=abc123');
  assert.ok(videoUrlError('https://youtube.com/playlist?list=PLtest'));
  assert.ok(videoUrlError('https://vimeo.com/'));
  assert.ok(videoUrlError('file:///tmp/video.mp4'));
  assert.ok(videoUrlError('not a URL'));
});
