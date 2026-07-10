# Media Library Specification

## Media entry interface

Existing fields remain supported. New entries may add an optional `nameKey`:

```json
{
  "md5": "Robot.svg",
  "width": 160,
  "height": 200,
  "ext": "svg",
  "name": "機器人",
  "nameKey": "CHARACTER_ROBOT",
  "order": "characters,08 custom"
}
```

Name resolution order is `nameKey` translation, legacy `CHARACTER_<md5>` or `BACKGROUND_<md5>` translation, then `name`.

## Requirements

- Built-in characters are SVG with transparent backgrounds; raster source may be supplied as transparent PNG for conversion.
- Built-in backgrounds use a 4:3 canvas, preferably SVG `viewBox="0 0 480 360"`.
- Library metadata width and height match the SVG viewBox or raster dimensions.
- Media changes are additive and do not invalidate existing projects.

