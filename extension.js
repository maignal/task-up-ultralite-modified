//    Task Up UltraLite
//    GNOME Shell extension
//    @fthx 2025


import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import { AppMenu } from 'resource:///org/gnome/shell/ui/appMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';


const ICON_SIZE = 16; // px
const UNFOCUSED_OPACITY = 128; // 0...255

const TaskButton = GObject.registerClass(
class TaskButton extends PanelMenu.Button {
    _init(window) {
        super._init();

        this._window = window;

        this.add_style_class_name('taskup-button');
        this._makeButtonBox();

        this._updateApp();
        this._updateTitle();
        this._updateWorkspace();
        this._updateVisibility();

        this._id = 'task-button-' + this._window;

        if (!Main.panel.statusArea[this._id])
            Main.panel.addToStatusArea(this._id, this, this._getIndex(), 'left');

        this._connectSignals();
    }

    _connectSignals() {
        global.workspace_manager.connectObject('active-workspace-changed', this._updateVisibility.bind(this), this);

        Main.overview.connectObject(
            'shown', this._updateVisibility.bind(this),
            'hidden', this._updateVisibility.bind(this),
            this);

        this._window.connectObject(
            'notify::appears-focused', this._updateFocus.bind(this),
            'notify::demands-attention', this._updateDemandsAttention.bind(this),
            'notify::gtk-application-id', this._updateApp.bind(this), GObject.ConnectFlags.AFTER,
            'notify::skip-taskbar', this._updateVisibility.bind(this),
            'notify::title', this._updateTitle.bind(this),
            'notify::wm-class', this._updateApp.bind(this), GObject.ConnectFlags.AFTER,
            'unmanaging', this._destroy.bind(this),
            'workspace-changed', this._updatePosition.bind(this),
            this);

        this.connectObject(
            'notify::hover', this._onHover.bind(this),
            'button-press-event', (widget, event) => this._onClick(event),
            this);
    }

    _disconnectSignals() {
        global.workspace_manager.disconnectObject(this);
        Main.overview.disconnectObject(this);
        this._window?.disconnectObject(this);
    }

    _makeButtonBox() {
        this._box = new St.BoxLayout();
        this._box.add_style_class_name('taskup-box');

        this._workspaceIndex = new St.Label({y_align: Clutter.ActorAlign.CENTER});
        this._workspaceIndex.add_style_class_name('taskup-workspace');
        this._box.add_child(this._workspaceIndex);

        this._icon = new St.Icon();
        this._icon.set_fallback_gicon(null);
        this._box.add_child(this._icon);

        this._title = new St.Label({y_align: Clutter.ActorAlign.CENTER});
        this._box.add_child(this._title);

        this.add_child(this._box);

        this.setMenu(new AppMenu(this));
    }

    _onClick(event) {
        if (event.get_button() == Clutter.BUTTON_PRIMARY) {
            this.menu.close();

            if (this._window?.has_focus()) {
                if (this._window?.can_minimize() && !Main.overview.visible)
                    this._window?.minimize();
            } else {
                this._window?.activate(global.get_current_time());
                this._window?.focus(global.get_current_time());
            }
            Main.overview.hide();

            return Clutter.EVENT_STOP;
        }

        if (event.get_button() == Clutter.BUTTON_MIDDLE) {
            this.menu.close();
            
            this._window?.delete(global.get_current_time());
            // if (this._app?.can_open_new_window())
            //     this._app?.open_new_window(-1);
            Main.overview.hide();

            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _onHover() {
        // if (!Main.wm._canScroll)
        //     return;

        // if (this.get_hover() && !this._window?.on_all_workspaces)
        //     this._window?.raise();
        // else
        //     global.display.focus_window?.raise();
    }

    _getIndex() {
        let index = 0;

        for (let bin of Main.panel._leftBox.get_children()) {
            let button = bin.child;

            if (button) {
                let thisButtonIsAfter = button._window?.get_workspace().index() <= this._window?.get_workspace().index();

                if (!(button instanceof TaskButton) || thisButtonIsAfter)
                    index++;
            }
        }

        return index;
    }

    _updatePosition() {
        let bin = this.container;

        if (Main.panel._leftBox.get_children().includes(bin)) {
            Main.panel._leftBox.remove_child(bin);
            Main.panel._leftBox.insert_child_at_index(bin, this._getIndex());
        }

        this._updateWorkspace();
    }

    _updateWorkspace() {
        let workspaceIndex = this._window?.get_workspace().index() + 1;

        this._workspaceIndex.set_text(workspaceIndex?.toString());
        this._workspaceIndex.visible = Main.overview.visible && !this._window?.on_all_workspaces;
    }

    _updateFocus() {
        if (Main.overview.visible || this._window?.appears_focused)
            this._box.set_opacity(255);
        else
            this._box.set_opacity(UNFOCUSED_OPACITY);
    }

    _updateDemandsAttention() {
        if (this._window?.demands_attention) {
            this._title.add_style_class_name('taskup-demands-attention');
            this._box.set_opacity(255);

            this._workspaceIndex.visible = Main.overview.visible || !this._windowIsOnActiveWorkspace;
            this.visible = true;
        } else {
            this._title.remove_style_class_name('taskup-demands-attention');

            this._updateVisibility();
        }
    }

    _updateTitle() {
        this._title.set_text(this._window?.get_title());
        // this._title.set_text(this._app?.get_name() || '');
    }

    _updateApp() {
        this._app = Shell.WindowTracker.get_default().get_window_app(this._window);

        if (this._app) {
            this._icon.set_gicon(this._app.get_icon());
            this._icon.set_icon_size(ICON_SIZE);
            
            this.menu.setApp(this._app);
            this.menu.setApp.set
        }
    }

    _updateVisibility() {
        this._updateFocus();
        this._updateWorkspace();

        this._activeWorkspace = global.workspace_manager.get_active_workspace();
        this._windowIsOnActiveWorkspace = this._window?.located_on_workspace(this._activeWorkspace);

        this.visible = Main.overview.visible || (!this._window?.is_skip_taskbar() && this._windowIsOnActiveWorkspace);
    }

    _destroy() {
        this._disconnectSignals();
        this.destroy();
    }
});

const TaskBar = GObject.registerClass(
class TaskBar extends GObject.Object {
    _init() {
        super._init();

        this._makeTaskbar();
        this._connectSignals();
    }

    _makeTaskButton(window) {
        if (!window || window.is_skip_taskbar() || window.get_window_type() == Meta.WindowType.MODAL_DIALOG)
            return;

        new TaskButton(window);
    }

    _destroyTaskbar() {
        if (this._makeTaskbarTimeout) {
            GLib.Source.remove(this._makeTaskbarTimeout);
            this._makeTaskbarTimeout = null;
        }

        for (let bin of Main.panel._leftBox.get_children()) {
            let button = bin.child;

            if (button && button instanceof TaskButton) {
                button._destroy();
                button = null;
            }
        }
    }

    _makeTaskbar() {
        this._moveDate(true);

        this._makeTaskbarTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            let workspacesNumber = global.workspace_manager.n_workspaces;

            for (let workspaceIndex = 0; workspaceIndex < workspacesNumber; workspaceIndex++) {
                let workspace = global.workspace_manager.get_workspace_by_index(workspaceIndex);
                let windowsList = workspace.list_windows();

                for (let window of windowsList)
                    this._makeTaskButton(window);
            }

            this._makeTaskbarTimeout = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    _moveDate(active) {
    //     let panel = Main.sessionMode.panel;

    //     if (active) {
    //         panel.center = panel.center.filter(item => item != 'dateMenu');
    //         if (!panel.right.includes('dateMenu'))
    //             panel.right.unshift('dateMenu');
    //     } else {
    //         panel.right = panel.right.filter(item => item != 'dateMenu');
    //         panel.center.unshift('dateMenu');
    //     }

    //     Main.panel._updatePanel();
    }

    _connectSignals() {
        global.display.connectObject('window-created', (display, window) => this._makeTaskButton(window), this);
        // Main.panel.connectObject('scroll-event', (actor, event) => Main.wm.handleWorkspaceScroll(event), this);
    }

    _disconnectSignals() {
        global.display.disconnectObject(this);
        Main.panel.disconnectObject(this);
    }

    _destroy() {
        this._disconnectSignals();
        this._destroyTaskbar();

        this._moveDate(false);
    }
});

export default class TaskUpUltraLiteExtension {
    enable() {
        this._taskbar = new TaskBar();
    }

    disable() {
        this._taskbar._destroy();
        this._taskbar = null;
    }
}
