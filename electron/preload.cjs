const { contextBridge, ipcRenderer } = require('electron');

/**
 * 预加载脚本：只暴露点名功能需要的最小 API。
 * 不开 nodeIntegration、保持 contextIsolation，渲染进程拿不到 Node 能力。
 */
contextBridge.exposeInMainWorld('rollcallBridge', {
	/**
	 * 打开系统文件选择框读取名单文本文件。
	 * @returns {Promise<{canceled:boolean, fileName?:string, text?:string, error?:string}>}
	 */
	pickNamesFile: () => ipcRenderer.invoke('pick-names-file')
});
