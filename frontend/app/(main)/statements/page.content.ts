import type { Dictionary } from 'intlayer';
import { statementsActions } from './translations/actions-translations';
import { statementsConfirmDelete } from './translations/confirm-delete-translations';
import { statementsDownload } from './translations/download-translations';
import { statementsEmpty } from './translations/empty-translations';
import { statementsFilters } from './translations/filters';
import { statementsGeneral } from './translations/general-translations';
import { statementsListHeader } from './translations/list-header-translations';
import { statementsLogs } from './translations/logs-translations';
import { statementsNotify } from './translations/notify-translations';
import { statementsPagination } from './translations/pagination-translations';
import { statementsPayables } from './translations/payables';
import { statementsReceivables } from './translations/receivables';
import { statementsSidePanel } from './translations/side-panel-translations';
import { statementsSpendOverTimeAnalytics } from './translations/spend-over-time-analytics';
import { statementsSpendOverTime } from './translations/spend-over-time-translations';
import { statementsStatus } from './translations/status-translations';
import { statementsTable } from './translations/table-translations';
import { statementsTopCategoriesAnalytics } from './translations/top-categories-analytics';
import { statementsTopMerchants } from './translations/top-merchants';
import { statementsTopSpenders } from './translations/top-spenders';
import { statementsTopTagsAnalytics } from './translations/top-tags-analytics-translations';
import { statementsTrash } from './translations/trash';
import { statementsUnapprovedCash } from './translations/unapproved-cash';
import { statementsUploadModal } from './translations/upload-modal';
import { statementsViewFile } from './translations/view-file-translations';
import { statementsWorkflow } from './translations/workflow-translations';

const content = {
  key: 'statementsPage',
  content: {
    filters: statementsFilters,
    listHeader: statementsListHeader,
    pagination: statementsPagination,
    trash: statementsTrash,
    sidePanel: statementsSidePanel,
    payables: statementsPayables,
    receivables: statementsReceivables,
    unapprovedCash: statementsUnapprovedCash,
    topSpenders: statementsTopSpenders,
    spendOverTime: statementsSpendOverTime,
    spendOverTimeAnalytics: statementsSpendOverTimeAnalytics,
    topMerchants: statementsTopMerchants,
    topTagsAnalytics: statementsTopTagsAnalytics,
    topCategoriesAnalytics: statementsTopCategoriesAnalytics,
    workflow: statementsWorkflow,
    table: statementsTable,
    actions: statementsActions,
    download: statementsDownload,
    viewFile: statementsViewFile,
    logs: statementsLogs,
    uploadModal: statementsUploadModal,
    confirmDelete: statementsConfirmDelete,
    status: statementsStatus,
    empty: statementsEmpty,
    notify: statementsNotify,
    ...statementsGeneral,
  },
} satisfies Dictionary;

export default content;
