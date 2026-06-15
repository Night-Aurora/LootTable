#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import os
import re
import shutil
import subprocess
import sys
import threading
import queue
from PIL import Image
from pathlib import Path
from datetime import datetime

# ==================== 配置 ====================
TEMP_REPO_BASE = "./temp_repos"
OUTPUT_DIR = Path("./textures")          # 输出目录
ERROR_LOG = Path("./errors.log")     # 错误日志文件
PNG_EXT = ".png"

# 线程配置
FETCH_THREADS = 2      # 拉取线程数
PROCESS_THREADS = 2    # 处理线程数
FETCH_QUEUE_SIZE = 100  # 待拉取队列大小
PROCESS_QUEUE_SIZE = 50 # 待处理队列大小

# Git 超时设置（秒）
GIT_TIMEOUT = 60

# 是否保留临时仓库（True=删除，False=保留用于调试）
CLEANUP_TEMP = False

# 停止信号
STOP_SIGNAL = None

# 全局锁用于写入错误日志
error_lock = threading.Lock()

FILTER_PATTERN = re.compile(r"(top|bottom|up|down|side|face|front|back|inner|open|closed|\d+$)", re.IGNORECASE)


# ==================== 日志记录 ====================
def log_error(repo_id: str, message: str):
    """写入错误日志，带时间戳"""
    timestamp = datetime.now().isoformat()
    with error_lock:
        with open(ERROR_LOG, "a", encoding="utf-8") as f:
            f.write(f"[{timestamp}] [{repo_id}] {message}\n")


# ==================== 稀疏检出实现 ====================
def sparse_clone_and_checkout(url, dest_dir, sparse_paths, branch=None):
    """
    使用稀疏检出只拉取指定路径的仓库内容
    sparse_paths: 需要检出的路径列表（相对于仓库根目录）
    返回 True 表示成功，False 表示失败
    """
    try:
        # 清理已存在的目录
        if os.path.exists(dest_dir):
            #return True  # 目录已存在，假设之前已经拉取过，直接跳过
            try:
                # 检查是否有更新
                subprocess.run(["git", "-C", dest_dir, "fetch", "--depth", "1"],
                    capture_output=True, text=True, timeout=GIT_TIMEOUT)
                result = subprocess.run(
                    ["git", "-C", dest_dir, "diff", "--name-only", "HEAD"],
                    capture_output=True, text=True, timeout=30)
                if result.returncode == 0:
                    changed_files = [f.strip() for f in result.stdout.split('\n') if f.strip()]
                    if not changed_files:
                        print(f"  [目录已存在且无改动] 跳过拉取")
                        return True
                    else:
                        print(f"  [目录已存在但有改动] 更新中...")
                        for file_path in changed_files:
                            subprocess.run(["git", "-C", dest_dir, "checkout", "--", file_path],
                                capture_output=True, text=True, timeout=10)
                        return True
            except Exception as e:
                print(f"  [检查目录失败] 错误: {e}，将重新拉取")
                shutil.rmtree(dest_dir)
        
        # 1. 浅克隆，不检出文件
        cmd_init = ["git", "clone", "--depth", "1", "--filter=blob:none", "--no-checkout"]
        if branch:
            cmd_init += ["--branch", branch, "--single-branch"]
        cmd_init += [url, dest_dir]
        result = subprocess.run(cmd_init, capture_output=True, text=True, timeout=GIT_TIMEOUT)
        if result.returncode != 0:
            print(f"  [拉取失败] {result.stderr.strip()}")
            return False
        
        # 2. 启用稀疏检出
        cmd_sparse = ["git", "-C", dest_dir, "sparse-checkout", "init", "--cone"]
        subprocess.run(cmd_sparse, capture_output=True, text=True, timeout=30)
        
        # 3. 设置要检出的路径
        cmd_set = ["git", "-C", dest_dir, "sparse-checkout", "set"] + sparse_paths
        subprocess.run(cmd_set, capture_output=True, text=True, timeout=30)
        
        # 4. 检出文件
        cmd_checkout = ["git", "-C", dest_dir, "checkout"]
        result_checkout = subprocess.run(cmd_checkout, capture_output=True, text=True, timeout=GIT_TIMEOUT)
        if result_checkout.returncode != 0:
            print(f"  [检出失败] {result_checkout.stderr.strip()}")
            return False
        
        return True
        
    except subprocess.TimeoutExpired:
        print(f"  [拉取失败] 超时")
        return False
    except Exception as e:
        print(f"  [拉取失败] 异常: {e}")
        return False


def get_sparse_paths(prefix, asset_id):
    """
    为指定的 asset_id 生成需要稀疏检出的路径列表
    """
    base_path = f"{prefix}src/main/resources/assets/{asset_id}/textures"
    return [
        f"{base_path}/block",
        f"{base_path}/item"
    ]
    
    读取文件前几个字节
    with open(src_file_path, "rb") as file: 
        header = file.read(24)  # PNG 文件头和 IHDR 块足够读取尺寸
        if header[:8] != b'\x89PNG\r\n\x1a\n':
            print(f"  [过滤] {src_file_path} (不是有效的 PNG 文件)")
            return False
        # IHDR 块在 PNG 文件头之后，包含宽高信息
        if len(header) < 24:
            print(f"  [过滤] {src_file_path} (文件过小，无法读取尺寸)")
            return False
        width = int.from_bytes(header[16:20], byteorder='big')
        height = int.from_bytes(header[20:24], byteorder='big')
        # 如果宽度或高度大于16，则过滤掉
        if width > 16 or height > 16:
            print(f"  [过滤] {src_file_path} (尺寸 {width}x{height} 超过 16x16)")
            return False

def should_record_file(src_file_path):
    filename = os.path.basename(src_file_path)
    
    # 如果匹配过滤模式，则不复制
    if FILTER_PATTERN.search(filename):
        print(f"  [过滤] {src_file_path} (匹配过滤模式)")
        return False

    try:
        with Image.open(src_file_path) as img:
            width, height = img.size
            # 如果宽度或高度大于16，则过滤掉
            if width > 16 or height > 16:
                print(f"  [过滤] {src_file_path} (尺寸 {width}x{height} 超过 16x16)")
                return False
    except Exception as e:
        # 图片损坏或无法读取，过滤掉
        print(f"[无法读取图片] {filename}，错误: {e}")
        return False
    
    return True

def collect_png_files(repo_path, prefix, asset_id):
    """
    从克隆的仓库中收集 PNG 文件信息
    返回：
        icons: dict {相对路径: [物品ID列表]}
        id_to_path: dict 用于检测ID冲突
    若两个源路径都不存在则返回 None
    """
    src_roots = [
        os.path.join(repo_path, prefix, "src", "main", "resources", "assets", asset_id, "textures", "item"),
        os.path.join(repo_path, prefix, "src", "main", "resources", "assets", asset_id, "textures", "block"),
    ]
    
    found_any = False
    icons = {}
    id_to_path = {}  # 物品ID -> 相对路径（用于冲突检测）
    
    for src_root in src_roots:
        if not os.path.isdir(src_root):
            continue
        
        found_any = True
        rel_prefix = os.path.basename(src_root)  # 'block' 或 'item'
        
        # 处理当前目录下的 .png 文件
        for png_file in Path(src_root).glob("*.png"):
            if(should_record_file(png_file)):
                rel_path = f"{rel_prefix}"
                item_id = png_file.stem
                _register_png(icons, id_to_path, asset_id, rel_path, item_id)
        
        # 处理一层子目录
        for subdir in Path(src_root).iterdir():
            if subdir.is_dir():
                for png_file in subdir.glob("*.png"):
                    if(should_record_file(png_file)):
                       rel_path = f"{rel_prefix}/{subdir.name}"
                       item_id = png_file.stem
                       _register_png(icons, id_to_path, asset_id, rel_path, item_id)
    #按照数量重新排序，确保数量多的路径优先
    icons = dict(sorted(icons.items(), key=lambda x: len(x[1]), reverse=True))
    
    if not found_any:
        return None
    
    return icons


def _register_png(icons, id_to_path, asset_id, rel_path, item_id):
    """注册一个 PNG 文件，处理冲突"""
    # 检查 ID 是否已经在其他路径出现
    if item_id in id_to_path and id_to_path[item_id] != rel_path:
        log_error(asset_id, f"ID conflict: '{item_id}' appears in both '{id_to_path[item_id]}' and '{rel_path}'. Skipping this file.")
        return
    # 如果没有冲突，更新映射
    id_to_path[item_id] = rel_path
    # 添加到 icons 字典
    if rel_path not in icons:
        icons[rel_path] = []
    if item_id not in icons[rel_path]:
        icons[rel_path].append(item_id)


def save_index_json(asset_id, repo_url, prefix, translation, icons):
    """
    保存索引 JSON 文件到 repo/ 目录
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_file = OUTPUT_DIR / f"{asset_id}.json"
    
    output_data = {
        "repository": repo_url,
        "prefix": prefix,
        "translation": translation,
        "icons": icons
    }
    
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    print(f"  [保存] {output_file}")
    return len(icons)


def parse_repo_url_and_branch(url):
    """
    从 URL 中解析仓库地址和分支。
    约定格式: https://github.com/owner/repo#branch
    """
    if not isinstance(url, str):
        return url, None
    raw = url.strip()
    if "#" not in raw:
        return raw, None
    repo_url, branch = raw.split("#", 1)
    repo_url = repo_url.strip()
    branch = branch.strip() or None
    return repo_url, branch


# ==================== 处理线程 ====================
def process_repo(asset_id, repo_url, prefix, repo_dir, branch):
    """处理单个仓库：收集 PNG 文件信息并生成索引 JSON"""
    print(f"[处理开始] {asset_id}")
    
    # 收集 PNG 文件
    icons = collect_png_files(f"{repo_dir}", prefix, asset_id)
    
    if icons is None:
        log_error(asset_id, f"未找到 block 或 item 目录: {prefix}src/main/resources/assets/{asset_id}/textures/{{block,item}}")
        print(f"[处理失败] {asset_id}: 未找到 block 或 item 目录")
        return False
    
    if not icons:
        log_error(asset_id, f"在指定路径下未找到任何 .png 文件")
        print(f"[处理警告] {asset_id}: 未找到任何 .png 文件，仍生成空索引")
    
    # 将分支信息追加到 repository_url 后面，保留 GitHub 仓库地址
    repo_url = repo_url.replace("github","raw.githubusercontent")
    repo_url_with_branch = repo_url if not branch else f"{repo_url}/{branch}"
    translation = f"{prefix}src/main/resources/assets/{asset_id}/lang/zh_cn.json"  # 约定的翻译文件路径
    

    # 保存索引 JSON
    icon_count = save_index_json(asset_id, repo_url_with_branch, prefix, translation, icons)
    print(f"[处理完成] {asset_id}: 已索引 {icon_count} 个图标路径")
    return True


# ==================== 拉取线程 ====================
def fetch_worker(fetch_queue, process_queue, repo_list, stop_event):
    """
    拉取线程工作函数
    从 fetch_queue 获取任务索引，执行拉取，完成后将结果放入 process_queue
    """
    while not stop_event.is_set():
        try:
            idx = fetch_queue.get(timeout=1)
        except queue.Empty:
            continue
        
        if idx is STOP_SIGNAL:
            fetch_queue.put(idx)
            break
        
        asset_id, url = repo_list[idx]
        prefix = "" # 不同的加载器，原代码路径不同。forge:没有前缀 neoforge:neoforge fabric:fabric
        
        if isinstance(url, list):
            if len(url) < 2:
                print(f"repo {asset_id} 的URL格式为数组，但是缺少第二个参数")
                continue
            prefix = url[1]
            url = url[0]

        # 从 URL 中读取分支（在解出 prefix 之后）
        url, branch = parse_repo_url_and_branch(url)
        print(f"[拉取开始] {asset_id}")
        
        # 生成稀疏检出路径
        sparse_paths = get_sparse_paths(prefix, asset_id)
        repo_dir = os.path.join(TEMP_REPO_BASE, asset_id)
        
        # 执行稀疏检出
        success = sparse_clone_and_checkout(url, repo_dir, sparse_paths, branch)
        
        if success:
            print(f"[拉取成功] {asset_id}")
            # 将处理任务放入待处理队列（包含 repo_url）
            process_queue.put((asset_id, url, repo_dir, prefix, branch))
        else:
            print(f"[拉取失败] {asset_id}")
            log_error(asset_id, f"Git 稀疏检出失败: {url}")
            process_queue.put(None)
        
        fetch_queue.task_done()
        #time.sleep(2)


def process_worker(process_queue, stop_event):
    """
    处理线程工作函数
    从 process_queue 获取仓库并处理
    """
    while not stop_event.is_set():
        try:
            task = process_queue.get(timeout=1)
        except queue.Empty:
            continue
        
        if task is STOP_SIGNAL:
            process_queue.put(task)
            break
        
        if task is None:
            process_queue.task_done()
            continue
        
        asset_id, repo_url, repo_dir, prefix, branch = task
        process_repo(asset_id, repo_url, prefix
                     , repo_dir, branch)
        
        # 根据配置决定是否删除临时仓库
        if CLEANUP_TEMP:
            shutil.rmtree(repo_dir, ignore_errors=True)
            print(f"  [清理] 已删除临时目录: {repo_dir}")
        else:
            print(f"  [保留] 临时目录: {repo_dir}")
        
        process_queue.task_done()


# ==================== 主函数 ====================
def load_repos(json_path):
    """加载 JSON 文件，返回 (id, url) 列表"""
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError("JSON 文件必须是一个对象，键为 id，值为 git URL")
    return list(data.items())


def main():
    if len(sys.argv) != 2:
        print("用法: python clone_and_index.py <repos.json>")
        sys.exit(1)
    
    json_path = sys.argv[1]
    if not os.path.isfile(json_path):
        print(f"错误: 文件 {json_path} 不存在")
        sys.exit(1)
    
    # 创建基础目录
    os.makedirs(TEMP_REPO_BASE, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # 清空或创建错误日志
    with open(ERROR_LOG, "w", encoding="utf-8") as f:
        f.write(f"# Error log - {datetime.now().isoformat()}\n")
    
    # 加载仓库列表
    try:
        repos = load_repos(json_path)
    except Exception as e:
        print(f"解析 JSON 失败: {e}")
        sys.exit(1)
    
    if not repos:
        print("没有要处理的仓库")
        return
    
    #print(list(dict(repos)))
    #return
    
    print(f"共加载 {len(repos)} 个仓库")
    print(f"拉取线程: {FETCH_THREADS}, 处理线程: {PROCESS_THREADS}")
    print(f"输出目录: {OUTPUT_DIR}")
    print(f"错误日志: {ERROR_LOG}")
    print(f"清理临时目录: {'是' if CLEANUP_TEMP else '否'}")
    print()
    
    # 创建队列
    fetch_queue = queue.Queue(maxsize=FETCH_QUEUE_SIZE)
    process_queue = queue.Queue(maxsize=PROCESS_QUEUE_SIZE)
    stop_event = threading.Event()
    
    
    # 将所有任务放入拉取队列
    for idx in range(len(repos)):
        fetch_queue.put(idx)
        
    # 启动拉取线程
    fetch_threads = []
    for _ in range(FETCH_THREADS):
        t = threading.Thread(
            target=fetch_worker,
            args=(fetch_queue, process_queue, repos, stop_event),
            daemon=True
        )
        t.start()
        fetch_threads.append(t)
    
    # 启动处理线程
    process_threads = []
    for _ in range(PROCESS_THREADS):
        t = threading.Thread(
            target=process_worker,
            args=(process_queue, stop_event),
            daemon=True
        )
        t.start()
        process_threads.append(t)
    
    # 等待拉取队列完成
    fetch_queue.join()
    
    # 等待处理队列完成
    process_queue.join()
    
    # 通知所有线程停止
    stop_event.set()
    
    # 等待线程结束
    for t in fetch_threads:
        t.join(timeout=5)
    for t in process_threads:
        t.join(timeout=5)
    
    print("\n=== 所有任务完成 ===")
    print(f"索引文件保存在: {OUTPUT_DIR}/")
    print(f"错误记录在: {ERROR_LOG}")
    
    # 输出repo所有键值为json数组
    print(list(dict(repos)))


if __name__ == "__main__":
    main()
