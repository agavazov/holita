# 174 Organize shared Basic images into folders

**Status:** Needs owner. Which Basic screen, if any, should use a shop-wide local image picker after 188? **Product:** Holita. Depends on [188](188-holita-basic-home-content.md).

## Background

red.bg has a shop file library with folders. Ticket 188 gives one Basic homepage setting a local image picker, and the wider library needs an explicitly approved Basic consumer.

## Goal

Allow reuse and folder organization when an approved Basic workflow needs shared images.

## Steps

1. Identify the approved Basic consumer and reuse 188's scoped image storage and validation. Add folder listing, move, rename and removal once the consumer can select the stored assets.
2. Preserve shop ownership checks and existing image references during folder changes.

## Done when

An approved Basic workflow can use an asset from an organized folder and another shop cannot read it.

## Limits

Deferred folder management only. One-image homepage selection belongs to 188.

## References

- [red.bg shared files](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Files/SharedFilesController.php)
- [Holita image validation](../../holita/apps/admin/src/image-upload.ts)
- [Holita current image selection](../../holita/apps/admin/src/image-upload.ts#L1)
