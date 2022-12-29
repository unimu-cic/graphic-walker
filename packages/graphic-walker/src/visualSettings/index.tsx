import {
    ArrowUturnLeftIcon,
    BarsArrowDownIcon,
    BarsArrowUpIcon,
    ChevronDownIcon,
    PhotoIcon,
    ArrowPathIcon,
    ArrowsPointingOutIcon,
    CubeIcon,
    Square3Stack3DIcon,
    StopIcon,
    ArrowUturnRightIcon,
} from '@heroicons/react/24/outline';
import { observer } from 'mobx-react-lite';
import React, { useMemo } from 'react';
import styled from 'styled-components'
import { useTranslation } from 'react-i18next';
import { LiteForm } from '../components/liteForm';
import SizeSetting from '../components/sizeSetting';
import { GEMO_TYPES, STACK_MODE, CHART_LAYOUT_TYPE } from '../config';
import { useGlobalStore } from '../store';
import { IStackMode, EXPLORATION_TYPES, IBrushDirection, BRUSH_DIRECTIONS } from '../interfaces';
import { IReactVegaHandler } from '../vis/react-vega';
import Toolbar, { ToolbarItemProps } from '../components/toolbar';
import { ButtonWithShortcut } from './menubar';


export const LiteContainer = styled.div`
    margin: 0.2em;
    border: 1px solid #d9d9d9;
    padding: 1em;
    background-color: #fff;
    .menu-root {
        position: relative;
        & > *:not(.trigger) {
            display: flex;
            flex-direction: column;
            position: absolute;
            right: 0;
            top: 100%;
            border: 1px solid #8884;
        }
        &:not(:hover) > *:not(.trigger):not(:hover) {
            display: none;
        }
    }
`;

const Invisible = styled.div`
    clip: rect(1px, 1px, 1px, 1px);
    clip-path: inset(50%);
    height: 1px;
    width: 1px;
    margin: -1px;
    overflow: hidden;
    padding: 0;
    position: absolute;
`;

interface IVisualSettings {
    rendererHandler?: React.RefObject<IReactVegaHandler>;
}

const VisualSettings: React.FC<IVisualSettings> = ({ rendererHandler }) => {
    const { vizStore } = useGlobalStore();
    const { visualConfig, sortCondition, canUndo, canRedo } = vizStore;
    const { t: tGlobal } = useTranslation();
    const { t } = useTranslation('translation', { keyPrefix: 'main.tabpanel.settings' });

    const { defaultAggregated, geoms: [markType], stack, interactiveScale } = visualConfig;

    const items = useMemo<ToolbarItemProps[]>(() => {
        return [
            {
                key: 'undo',
                label: 'undo (Ctrl + Z)',
                icon: () => (
                    <>
                        <ArrowUturnLeftIcon />
                        <Invisible aria-hidden>
                            <ButtonWithShortcut
                                label="undo"
                                disabled={!canUndo}
                                handler={vizStore.undo.bind(vizStore)}
                                shortcut="Ctrl+Z"
                            />
                        </Invisible>
                    </>
                ),
                onClick: () => vizStore.undo(),
                disabled: !canUndo,
            },
            {
                key: 'redo',
                label: 'redo (Ctrl+Shift+Z)',
                icon: () => (
                    <>
                        <ArrowUturnRightIcon />
                        <Invisible aria-hidden>
                            <ButtonWithShortcut
                                label="redo"
                                disabled={!canRedo}
                                handler={vizStore.redo.bind(vizStore)}
                                shortcut="Ctrl+Shift+Z"
                            />
                        </Invisible>
                    </>
                ),
                onClick: () => vizStore.redo(),
                disabled: !canRedo,
            },
            '-',
            {
                key: 'aggregation',
                label: t('toggle.aggregation'),
                icon: CubeIcon,
                checked: defaultAggregated,
                onChange: checked => {
                    vizStore.setVisualConfig('defaultAggregated', checked);
                },
            },
            {
                key: 'mark_type',
                label: tGlobal('constant.mark_type.__enum__'),
                icon: StopIcon,
                options: GEMO_TYPES.map(g => ({
                    key: g,
                    label: tGlobal(`constant.mark_type.${g}`),
                    icon: () => <></>,
                })),
                value: markType,
                onSelect: value => {
                    vizStore.setVisualConfig('geoms', [value]);
                },
            },
            {
                key: 'stack_mode',
                label: tGlobal('constant.stack_mode.__enum__'),
                icon: Square3Stack3DIcon,
                options: STACK_MODE.map(g => ({
                    key: g,
                    label: tGlobal(`constant.stack_mode.${g}`),
                    icon: () => <></>,
                })),
                value: stack,
                onSelect: value => {
                    vizStore.setVisualConfig('stack', value as IStackMode);
                },
            },
            {
                key: 'axes_resize',
                label: t('toggle.axes_resize'),
                icon: ArrowsPointingOutIcon,
                checked: interactiveScale,
                onChange: checked => {
                    vizStore.setVisualConfig('interactiveScale', checked);
                },
            },
            '-',
            {
                key: 'transpose',
                label: t('button.transpose'),
                icon: () => <ArrowPathIcon />,
                onClick: () => vizStore.transpose(),
            },
            {
                key: 'sort:asc',
                label: t('button.ascending'),
                icon: () => <BarsArrowUpIcon />,
                onClick: () => vizStore.applyDefaultSort('ascending'),
            },
            {
                key: 'sort:dec',
                label: t('button.descending'),
                icon: () => <BarsArrowDownIcon />,
                onClick: () => vizStore.applyDefaultSort('descending'),
            },
            '-',
        ];
    }, [vizStore, canUndo, canRedo, defaultAggregated, markType, stack, interactiveScale]);

    return <>
    <div style={{ margin: '0.38em 0.2em' }}>
        <Toolbar
            items={items}
            styles={{
                root: {
                    '--background-color': '#fff',
                    '--color': '#777',
                    '--color-hover': '#555',
                    '--blue': '#282958',
                    '--blue-dark': '#1d1e38',
                },
                container: {
                    border: '1px solid #d9d9d9',
                    boxSizing: 'content-box',
                },
            }}
        />
    </div>
    <LiteContainer>
        <LiteForm style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="item">
                <label
                    id="dropdown:layout_type:label"
                    htmlFor="dropdown:layout_type"
                >
                    {tGlobal(`constant.layout_type.__enum__`)}
                </label>
                <select
                    className="border border-gray-500 rounded-sm text-xs pt-0.5 pb-0.5 pl-2 pr-2 cursor-pointer"
                    id="dropdown:layout_type"
                    aria-describedby="dropdown:layout_type:label"
                    value={visualConfig.size.mode}
                    onChange={(e) => {
                        // vizStore.setVisualConfig('geoms', [e.target.value]);
                        vizStore.setChartLayout({
                            mode: e.target.value as any
                        })
                    }}
                >
                    {CHART_LAYOUT_TYPE.map(g => (
                        <option
                            key={g}
                            value={g}
                            className="cursor-pointer"
                            aria-selected={visualConfig.size.mode === g}
                        >
                            {tGlobal(`constant.layout_type.${g}`)}
                        </option>
                    ))}
                </select>
            </div>
            <div className="item hover:bg-yellow-100">
                <SizeSetting
                    width={visualConfig.size.width}
                    height={visualConfig.size.height}
                    onHeightChange={(v) => {
                        vizStore.setChartLayout({
                            mode: "fixed",
                            height: v
                        })
                    }}
                    onWidthChange={(v) => {
                        vizStore.setChartLayout({
                            mode: "fixed",
                            width: v
                        })
                    }}
                />
                <label
                    className="text-xs text-color-gray-700 ml-2"
                    htmlFor="button:size_setting"
                    id="button:size_setting:label"
                >
                    {t('size')}
                </label>
            </div>
            <div className="item">
                <label
                    id="dropdown:exploration_mode:label"
                    htmlFor="dropdown:exploration_mode"
                >
                    {tGlobal(`constant.exploration_mode.__enum__`)}
                </label>
                <select
                    className="border border-gray-500 rounded-sm text-xs pt-0.5 pb-0.5 pl-2 pr-2 cursor-pointer"
                    id="dropdown:exploration_mode"
                    aria-describedby="dropdown:exploration_mode:label"
                    value={visualConfig.exploration.mode}
                    onChange={e => {
                        vizStore.setExploration({
                            mode: e.target.value as (typeof EXPLORATION_TYPES)[number]
                        });
                    }}
                >
                    {EXPLORATION_TYPES.map(g => (
                        <option
                            key={g}
                            value={g}
                            className="cursor-pointer"
                            aria-selected={visualConfig.exploration.mode === g}
                        >
                            {tGlobal(`constant.exploration_mode.${g}`)}
                        </option>
                    ))}
                </select>
            </div>
            <div className="item" style={{ opacity: visualConfig.exploration.mode !== 'brush' ? 0.3 : undefined }}>
                <label
                    id="dropdown:brush_mode:label"
                    htmlFor="dropdown:brush_mode"
                >
                    {tGlobal(`constant.brush_mode.__enum__`)}
                </label>
                <select
                    className="border border-gray-500 rounded-sm text-xs pt-0.5 pb-0.5 pl-2 pr-2 cursor-pointer"
                    id="dropdown:brush_mode"
                    aria-describedby="dropdown:brush_mode:label"
                    disabled={visualConfig.exploration.mode !== 'brush'}
                    aria-disabled={visualConfig.exploration.mode !== 'brush'}
                    value={visualConfig.exploration.brushDirection}
                    onChange={e => {
                        vizStore.setExploration({
                            brushDirection: e.target.value as IBrushDirection
                        });
                    }}
                >
                    {BRUSH_DIRECTIONS.map(g => (
                        <option
                            key={g}
                            value={g}
                            className="cursor-pointer"
                            aria-selected={visualConfig.exploration.brushDirection === g}
                        >
                            {tGlobal(`constant.brush_mode.${g}`)}
                        </option>
                    ))}
                </select>
            </div>
            <div className="item">
                <input
                    type="checkbox"
                    checked={visualConfig.showActions}
                    id="toggle:debug"
                    aria-describedby="toggle:debug:label"
                    className="cursor-pointer"
                    onChange={(e) => {
                        vizStore.setVisualConfig('showActions', e.target.checked);
                    }}
                />
                <label
                    className="text-xs text-color-gray-700 ml-2 cursor-pointer"
                    id="toggle:debug:label"
                    htmlFor="toggle:debug"
                >
                    {t('toggle.debug')}
                </label>
            </div>
            <div className='item'>
                <label
                    className="text-xs text-color-gray-700 mr-2"
                    htmlFor="button:transpose"
                    id="button:transpose:label"
                >
                    {t('button.export_chart')}
                </label>
                <PhotoIcon
                    className="w-4 inline-block cursor-pointer"
                    role="button"
                    tabIndex={0}
                    id="button:export_chart"
                    aria-describedby="button:export_chart:label"
                    xlinkTitle={t('button.export_chart')}
                    aria-label={t('button.export_chart')}
                    onClick={() => rendererHandler?.current?.downloadPNG()}
                />
                <div className="menu-root flex flex-col items-center justify-center">
                    <ChevronDownIcon
                        className="w-4 h-3 inline-block mr-1 cursor-pointer trigger"
                        role="button"
                        tabIndex={0}
                    />
                    <div>
                        <button
                            className="text-xs min-w-96 w-full pt-1 pb-1 pl-6 pr-6 bg-white hover:bg-gray-200"
                            aria-label={t('button.export_chart_as', { type: 'png' })}
                            onClick={() => rendererHandler?.current?.downloadPNG()}
                        >
                            {t('button.export_chart_as', { type: 'png' })}
                        </button>
                        <button
                            className="text-xs min-w-96 w-full pt-1 pb-1 pl-6 pr-6 bg-white hover:bg-gray-200"
                            aria-label={t('button.export_chart_as', { type: 'svg' })}
                            onClick={() => rendererHandler?.current?.downloadSVG()}
                        >
                            {t('button.export_chart_as', { type: 'svg' })}
                        </button>
                    </div>
                </div>
            </div>
        </LiteForm>
    </LiteContainer></>
}

export default observer(VisualSettings);