// Aurora DashboardMenu for record actions, including the Events trash workflow.
import { Button, Menu, MenuItem, listClasses, menuClasses } from '@mui/material';
import { useId, useState } from 'react';
import EllipsisHorizontalIcon from './ellipsis-horizontal-icon.js';

export function RecordActions({
  name,
  tabIndex,
  disabled,
  onEdit,
  onDelete,
  onView,
  editLabel = 'Edit',
  deleteLabel = 'Delete',
}: {
  name: string;
  tabIndex: number;
  disabled: boolean;
  onEdit: () => void;
  onDelete?: () => void;
  onView?: () => void;
  editLabel?: string;
  deleteLabel?: string;
}) {
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
        aria-label={`Actions for ${name}`}
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
            View
          </MenuItem>
        )}
        <MenuItem
          onClick={(event) => {
            event.stopPropagation();
            setAnchor(null);
            onEdit();
          }}
        >
          {editLabel}
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
            {deleteLabel}
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
