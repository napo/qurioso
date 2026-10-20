import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { guideScreenshot, guideScreenshotText } from '../src/i18n/guideScreenshots';

test('every tutorial screenshot exists in all languages and is a real, nonempty PNG capture', async () => {
  for (const language of ['it','en','de'] as const) {
    assert.ok(guideScreenshotText[language].caption.includes('geopop'));
    for(const name of new Set(Object.values(guideScreenshot))) {
      const data=await readFile(new URL(`../public/guide/${language}/${name}.png`,import.meta.url));
      assert.equal(data.subarray(1,4).toString(),'PNG');
      assert.ok(data.readUInt32BE(16)>=320,`${language}/${name} has no usable width`);
      assert.ok(data.readUInt32BE(20)>=400,`${language}/${name} has no usable height`);
    }
  }
});
