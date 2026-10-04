// Aurora DashboardMenu for record actions, including the Events trash workflow.
import { Button, Menu, MenuItem, listClasses, menuClasses } from '@mui/material';
import { useId, useState } from 'react';
import EllipsisHorizontalIcon from './ellipsis-horizontal-icon.js';
import { useLocalization } from '../localization/localization-provider.js';

export function RecordActions({
  name,
  tabIndex,
  disabled,
  onEdit,
  onDelete,
  onView,
  editLabel,
  deleteLabel,
  actionsLabel,
}: {
  name: string;
  tabIndex: number;
  disabled: boolean;
  onEdit: () => void;
  onDelete?: () => void;
  onView?: () => void;
  editLabel?: string;
  deleteLabel?: string;
  actionsLabel?: string;
}) {
  const { t } = useLocalization();
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Button
        id={id}
        tabIndex={tabIndex}
        size="small"
        variant="text"
        shape="square"
        color="neutral"
        disabled={disabled}
        aria-label={actionsLabel ?? t('common.actionsFor', { name })}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        aria-controls={anchor ? `${id}-menu` : undefined}
        sx={{ color: 'text.primary' }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setAnchor(event.currentTarget);
        }}
      >
        <EllipsisHorizontalIcon sx={{ pointerEvents: 'none' }} />
      </Button>
      <Menu
        id={`${id}-menu`}
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => {
          setAnchor(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ [`& .${menuClasses.paper} .${listClasses.root}`]: { minWidth: 120 } }}
        slotProps={{ list: { 'aria-labelledby': id } }}
      >
        {onView && (
          <MenuItem
            onClick={(event) => {
              event.stopPropagation();
              setAnchor(null);
              onView();
            }}
          >
            {t('common.view')}
          </MenuItem>
        )}
        <MenuItem
          onClick={(event) => {
            event.stopPropagation();
            setAnchor(null);
            onEdit();
          }}
        >
          {editLabel ?? t('common.edit')}
        </MenuItem>
        {onDelete && (
          <MenuItem
            sx={{ color: 'error.main' }}
            onClick={(event) => {
              event.stopPropagation();
              setAnchor(null);
              onDelete();
            }}
          >
            {deleteLabel ?? t('common.delete')}
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
