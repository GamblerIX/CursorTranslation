const fs = require('fs');
const path = require('path');

/**
 * 翻译合并器类
 * 用于在启动前检查并合并 yes-zh-cn.json 文件到 zh-cn.json
 */
class TranslationMerger {
    constructor() {
        this.translationsDir = path.join(__dirname, '..', 'translations');
        this.zhCnFile = path.join(this.translationsDir, 'zh-cn.json');
        this.yesZhCnFile = path.join(this.translationsDir, 'yes-zh-cn.json');
        this.backupFile = path.join(this.translationsDir, 'zh-cn.json.backup');
        this.mergeLog = [];
    }

    static log(level, message) {
        if (level === 'ERROR') {
            console.log(message);
        }
    }

    /**
     * 安全读取文件
     */
    safeReadFile(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                return null;
            }
            const content = fs.readFileSync(filePath, 'utf-8');
            return content;
        } catch (error) {
            TranslationMerger.log('ERROR', `读取文件失败: ${filePath} - ${error.message}`);
            this.mergeLog.push({
                type: 'READ_ERROR',
                file: filePath,
                error: error.message
            });
            return null;
        }
    }

    /**
     * 安全写入文件
     */
    safeWriteFile(filePath, content) {
        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                TranslationMerger.log('INFO', `创建目录: ${dir}`);
            }
            fs.writeFileSync(filePath, content, 'utf-8');
            TranslationMerger.log('SUCCESS', `成功写入文件: ${filePath}`);
            return true;
        } catch (error) {
            TranslationMerger.log('ERROR', `写入文件失败: ${filePath} - ${error.message}`);
            this.mergeLog.push({
                type: 'WRITE_ERROR',
                file: filePath,
                error: error.message
            });
            return false;
        }
    }

    /**
     * 解析JSON文件
     */
    parseJsonFile(filePath) {
        const content = this.safeReadFile(filePath);
        if (!content) {
            return null;
        }

        try {
            const parsed = JSON.parse(content);
            TranslationMerger.log('INFO', `成功解析JSON文件: ${filePath}`);
            return parsed;
        } catch (error) {
            TranslationMerger.log('ERROR', `JSON解析失败: ${filePath} - ${error.message}`);
            this.mergeLog.push({
                type: 'JSON_PARSE_ERROR',
                file: filePath,
                error: error.message
            });
            return null;
        }
    }

    /**
     * 创建备份
     */
    createBackup() {
        if (!fs.existsSync(this.zhCnFile)) {
            TranslationMerger.log('WARN', 'zh-cn.json 文件不存在，无需备份');
            return true;
        }

        const content = this.safeReadFile(this.zhCnFile);
        if (!content) {
            return false;
        }

        return this.safeWriteFile(this.backupFile, content);
    }

    /**
     * 深度合并对象
     */
    deepMerge(target, source) {
        const result = { ...target };
        
        for (const [key, value] of Object.entries(source)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                result[key] = this.deepMerge(result[key] || {}, value);
            } else {
                result[key] = value;
            }
        }
        
        return result;
    }

    /**
     * 统计合并结果
     */
    countTranslations(translations) {
        let total = 0;
        let categories = 0;
        
        for (const [category, items] of Object.entries(translations)) {
            if (typeof items === 'object' && items !== null) {
                categories++;
                total += Object.keys(items).length;
            }
        }
        
        return { total, categories };
    }

    /**
     * 检查并合并翻译文件
     */
    checkAndMerge() {
        TranslationMerger.log('INFO', '开始检查翻译文件合并...');
        
        // 检查 yes-zh-cn.json 是否存在
        if (!fs.existsSync(this.yesZhCnFile)) {
            TranslationMerger.log('INFO', 'yes-zh-cn.json 文件不存在，跳过合并');
            return { success: true, merged: false, reason: '文件不存在' };
        }

        // 读取现有翻译文件
        const existingTranslations = this.parseJsonFile(this.zhCnFile);
        if (!existingTranslations) {
            TranslationMerger.log('ERROR', '无法读取现有的 zh-cn.json 文件');
            return { success: false, merged: false, reason: '无法读取现有文件' };
        }

        // 读取要合并的文件
        const newTranslations = this.parseJsonFile(this.yesZhCnFile);
        if (!newTranslations) {
            TranslationMerger.log('ERROR', '无法读取 yes-zh-cn.json 文件');
            return { success: false, merged: false, reason: '无法读取合并文件' };
        }

        // 统计合并前的情况
        const beforeStats = this.countTranslations(existingTranslations);
        TranslationMerger.log('INFO', `合并前: ${beforeStats.total} 个词条，${beforeStats.categories} 个分类`);

        // 创建备份
        if (!this.createBackup()) {
            TranslationMerger.log('WARN', '备份创建失败，但继续合并');
        }

        // 执行深度合并
        const mergedTranslations = this.deepMerge(existingTranslations, newTranslations);
        
        // 统计合并后的情况
        const afterStats = this.countTranslations(mergedTranslations);
        const addedTranslations = afterStats.total - beforeStats.total;
        const addedCategories = afterStats.categories - beforeStats.categories;

        TranslationMerger.log('INFO', `合并后: ${afterStats.total} 个词条，${afterStats.categories} 个分类`);
        TranslationMerger.log('INFO', `新增: ${addedTranslations} 个词条，${addedCategories} 个分类`);

        // 写入合并后的文件
        const jsonString = JSON.stringify(mergedTranslations, null, 2);
        if (!this.safeWriteFile(this.zhCnFile, jsonString)) {
            TranslationMerger.log('ERROR', '写入合并后的文件失败');
            return { success: false, merged: false, reason: '写入失败' };
        }

        // 记录合并日志
        this.mergeLog.push({
            type: 'MERGE_SUCCESS',
            timestamp: new Date().toISOString(),
            before: beforeStats,
            after: afterStats,
            added: {
                translations: addedTranslations,
                categories: addedCategories
            }
        });

        TranslationMerger.log('SUCCESS', `成功合并翻译文件，新增 ${addedTranslations} 个词条`);
        return { 
            success: true, 
            merged: true, 
            reason: '合并成功',
            stats: {
                before: beforeStats,
                after: afterStats,
                added: {
                    translations: addedTranslations,
                    categories: addedCategories
                }
            }
        };
    }

    /**
     * 生成合并报告
     */
    generateMergeReport(result) {
        const report = {
            timestamp: new Date().toISOString(),
            success: result.success,
            merged: result.merged,
            reason: result.reason,
            stats: result.stats || null,
            log: this.mergeLog
        };

        const reportFile = path.join(this.translationsDir, 'merge-report.json');
        this.safeWriteFile(reportFile, JSON.stringify(report, null, 2));
        
        TranslationMerger.log('INFO', `生成合并报告: ${reportFile}`);
        return report;
    }

    /**
     * 主执行方法
     */
    run() {
        TranslationMerger.log('INFO', '开始翻译文件合并检查...');
        
        try {
            const result = this.checkAndMerge();
            
            // 生成报告
            const report = this.generateMergeReport(result);
            
            // 输出摘要
            TranslationMerger.log('SUCCESS', '翻译合并检查完成！');
            TranslationMerger.log('INFO', `合并状态: ${result.merged ? '已合并' : '未合并'}`);
            TranslationMerger.log('INFO', `错误数量: ${this.mergeLog.filter(log => log.type.includes('ERROR')).length}`);
            
            if (result.merged && result.stats) {
                TranslationMerger.log('INFO', `新增词条: ${result.stats.added.translations}`);
                TranslationMerger.log('INFO', `新增分类: ${result.stats.added.categories}`);
            }

            return result;
        } catch (error) {
            TranslationMerger.log('ERROR', `执行过程中发生错误: ${error.message}`);
            this.mergeLog.push({
                type: 'RUNTIME_ERROR',
                error: error.message,
                stack: error.stack
            });
            return { success: false, merged: false, reason: error.message };
        }
    }
}

/**
 * 命令行入口
 */
function main() {
    const merger = new TranslationMerger();
    const result = merger.run();
    
    if (!result.success) {
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = TranslationMerger;