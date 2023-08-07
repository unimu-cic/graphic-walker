import React, { useEffect, useMemo, useState, useRef } from 'react';
import { StoreWrapper, useGlobalStore } from '../../store';
import { PivotTableDataProps, PivotTableStoreWrapper, usePivotTableStore } from './store';
import { applyViewQuery, buildPivotTableService } from '../../services';
import { observer } from 'mobx-react-lite';
import LeftTree from './leftTree';
import TopTree from './topTree';
import {
    DeepReadonly,
    DraggableFieldState,
    IDarkMode,
    IRow,
    IThemeKey,
    IViewField,
    IVisualConfig,
} from '../../interfaces';
import { INestNode } from './inteface';
import { buildMetricTableFromNestTree, buildNestTree } from './utils';
import { getMeaAggKey } from '../../utils';
import { unstable_batchedUpdates } from 'react-dom';
import MetricTable from './metricTable';
import { toJS } from 'mobx';
import LoadingLayer from '../loadingLayer';

// const PTStateConnector = observer(function StateWrapper (props: PivotTableProps) {
//     const store = usePivotTableStore();
//     const { vizStore } = useGlobalStore();
//     const { draggableFieldState } = vizStore;
//     const { rows, columns } = draggableFieldState;
//     return (
//         <PivotTable
//             {...props}
//             draggableFieldState={draggableFieldState}
//             visualConfig={visualConfig}
//         />
//     );
// })

interface PivotTableProps {
    themeKey?: IThemeKey;
    dark?: IDarkMode;
    data: IRow[];
    transformedData: IRow[];
    loading: boolean;
    draggableFieldState: DeepReadonly<DraggableFieldState>;
    visualConfig: DeepReadonly<IVisualConfig>;
}
const PivotTable: React.FC<PivotTableProps> = observer(function PivotTableComponent (props) {
    const { data, transformedData, loading } = props;
    const [leftTree, setLeftTree] = useState<INestNode | null>(null);
    const [topTree, setTopTree] = useState<INestNode | null>(null);
    const [metricTable, setMetricTable] = useState<any[][]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const { vizStore, commonStore } = useGlobalStore();
    const { allFields, viewFilters, viewMeasures, visualConfig, draggableFieldState } = vizStore;
    const { rows, columns } = draggableFieldState;
    const { showTableSummary } = visualConfig;
    const { currentDataset, tableCollapsedHeaderMap } = commonStore;
    const { dataSource } = currentDataset;
    const aggData = useRef<IRow[]>([]);
    const [ topTreeHeaderRowNum, setTopTreeHeaderRowNum ] = useState<number>(0);

    const dimsInRow = useMemo(() => {
        return toJS(rows).filter((f) => f.analyticType === 'dimension');
    }, [rows]);

    const dimsInColumn = useMemo(() => {
        return toJS(columns).filter((f) => f.analyticType === 'dimension');
    }, [columns]);

    const measInRow = useMemo(() => {
        return rows.filter((f) => f.analyticType === 'measure');
    }, [rows]);

    const measInColumn = useMemo(() => {
        return columns.filter((f) => f.analyticType === 'measure');
    }, [columns]);

    useEffect(() => {
        setIsLoading(loading);
    }, [loading])

    // If some visual configs change, clear the collapse state, then regroup the data
    useEffect(() => {
        if (tableCollapsedHeaderMap.size > 0) {
            commonStore.resetTableCollapsedHeader();
        }
        aggregateGroupbyData();
    }, [transformedData]);

    useEffect(() => {
        if (showTableSummary) {
            // If the table summary is on, there is no need to generate extra queries. Directly generate new table.
            generateNewTable();
        } else {
            aggregateGroupbyData();
        }
    }, [tableCollapsedHeaderMap]);

    const generateNewTable = () => {
        setIsLoading(true);
        buildPivotTableService(
            dimsInRow,
            dimsInColumn,
            data,
            aggData.current,
            Array.from(tableCollapsedHeaderMap.keys()),
            showTableSummary
        )
            .then((data) => {
                const {lt, tt, metric} = data;
                unstable_batchedUpdates(() => {
                    setLeftTree(lt);
                    setTopTree(tt);
                    setMetricTable(metric);
                });
                setIsLoading(false);
            })
            .catch((err) => {
                console.log(err);
                setIsLoading(false);
            })
    };

    const aggregateGroupbyData = () => {
        if (dimsInRow.length === 0 && dimsInColumn.length === 0) return;
        if (data.length === 0) return;
        let groupbyCombListInRow:IViewField[][]  = [];
        let groupbyCombListInCol:IViewField[][]  = [];
        if (showTableSummary) {
            groupbyCombListInRow = dimsInRow.map((dim, idx) => dimsInRow.slice(0, idx));
            groupbyCombListInCol = dimsInColumn.map((dim, idx) => dimsInColumn.slice(0, idx));
        } else {
            const collapsedDimList = Array.from(tableCollapsedHeaderMap).map(([key, path]) => path[path.length - 1].key);
            const collapsedDimsInRow = dimsInRow.filter((dim) => collapsedDimList.includes(dim.fid));
            const collapsedDimsInColumn = dimsInColumn.filter((dim) => collapsedDimList.includes(dim.fid));
            groupbyCombListInRow = collapsedDimsInRow.map((dim) => dimsInRow.slice(0, dimsInRow.indexOf(dim) + 1));
            groupbyCombListInCol = collapsedDimsInColumn.map((dim) => dimsInColumn.slice(0, dimsInColumn.indexOf(dim) + 1));
        }
        groupbyCombListInRow.push(dimsInRow);
        groupbyCombListInCol.push(dimsInColumn);
        const groupbyCombList:IViewField[][] = groupbyCombListInCol.flatMap(combInCol =>
            groupbyCombListInRow.map(combInRow => [...combInCol, ...combInRow])
        ).slice(0, -1);

        setIsLoading(true);
        const groupbyPromises = groupbyCombList.map((dimComb) => {
            const dims = dimComb;
            const meas = viewMeasures;
            const config = toJS(vizStore.visualConfig);
            return applyViewQuery(transformedData, dims.concat(meas), {
                op: config.defaultAggregated ? 'aggregate' : 'raw',
                groupBy: dimComb.map((f) => f.fid),
                measures: meas.map((f) => ({ field: f.fid, agg: f.aggName as any, asFieldKey: getMeaAggKey(f.fid, f.aggName!) })),
            })
            .catch((err) => {
                console.error(err);
                return [];
            });
        });
        Promise.all(groupbyPromises)
            .then((result) => {
                const finalizedData = [...result.flat()];
                aggData.current = finalizedData;
                generateNewTable();
            })
            .catch((err) => {
                console.error(err);
                setIsLoading(false);
            });
    };

    // const { leftTree, topTree, metricTable } = store;
    return (
        <div className="relative">
            {isLoading && <LoadingLayer />}
            <div className="flex">
                <table className="border border-gray-300 border-collapse">
                    <thead className="border border-gray-300">
                        {new Array(topTreeHeaderRowNum).fill(0).map((_, i) => (
                            <tr className="" key={i}>
                                <td className="bg-zinc-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-100 p-2 m-1 text-xs border border-gray-300" colSpan={dimsInRow.length + (measInRow.length > 0 ? 1 : 0)}>_</td>
                            </tr>
                        ))}
                    </thead>
                    {leftTree && 
                        <LeftTree 
                            data={leftTree} 
                            dimsInRow={dimsInRow} 
                            measInRow={measInRow} 
                            onHeaderCollapse={commonStore.updateTableCollapsedHeader.bind(commonStore)}
                        />}
                </table>
                <table className="border border-gray-300 border-collapse">
                    {topTree && 
                        <TopTree 
                            data={topTree} 
                            dimsInCol={dimsInColumn} 
                            measInCol={measInColumn} 
                            onHeaderCollapse={commonStore.updateTableCollapsedHeader.bind(commonStore)}
                            onTopTreeHeaderRowNumChange={(num) => setTopTreeHeaderRowNum(num)}
                        />}
                    {metricTable && 
                        <MetricTable 
                            matrix={metricTable} 
                            meaInColumns={measInColumn} 
                            meaInRows={measInRow} 
                        />}
                </table>
            </div>
        </div>

    );
});

export default PivotTable;

// const PivotTableApp: React.FC<PivotTableProps> = (props) => {
//     return (
//         <PivotTableStoreWrapper {...props}>
//             <PivotTable />
//         </PivotTableStoreWrapper>
//     );
// };
