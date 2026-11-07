import { TableCell, TableRow } from '@mui/material';
import Skeleton from '@mui/material/Skeleton';

export const USER_ROW_SKELETON_KEYS = ['user-0', 'user-1', 'user-2', 'user-3', 'user-4', 'user-5'];

export function UserRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton variant="text" width="80%" height={20} />
      </TableCell>
      <TableCell>
        <Skeleton variant="text" width="70%" height={20} />
      </TableCell>
      <TableCell>
        <Skeleton variant="rounded" width={120} height={32} />
      </TableCell>
      <TableCell>
        <Skeleton variant="rounded" width={70} height={24} />
      </TableCell>
      <TableCell>
        <Skeleton variant="rounded" width={40} height={24} />
      </TableCell>
      <TableCell>
        <Skeleton variant="text" width={90} height={20} />
      </TableCell>
      <TableCell>
        <Skeleton variant="circular" width={24} height={24} />
      </TableCell>
    </TableRow>
  );
}
