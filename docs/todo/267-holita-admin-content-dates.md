# 267 Format Admin content dates with shared preferences

**Status:** Ready. **Product:** Holita.

## Background

Admin Pages and Blog format timestamps in UTC while Orders and Customers use the shared Europe/Sofia preference. Work saved around 00:30 Sofia time can appear under the previous date in the content lists.

## Goal

Show a consistent local calendar date for the same timestamp across the merchant Admin.

## Steps

1. Apply the shared display format and language preferences in the Pages and Blog article lists.
2. Compare a timestamp near local midnight with the Orders display in BG and EN.

## Done when

Pages and Blog display the same local date as Orders for the same timestamp in both supported languages.

## Limits

Limit the change to display formatting through the existing preferences.

## References

- [red.bg Pages controller](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/PagesController.php)
- [red.bg Blog controller](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Blog/BlogController.php)
- [Holita Pages date formatting](../../holita/apps/admin/src/pages/pages-page.ts#L234)
- [Holita Blog date formatting](../../holita/apps/admin/src/blog/blog-articles-page.ts#L235)
- [Shared display preferences](../../osnova/packages/ui/src/ui/format/display-preferences.ts#L15)
