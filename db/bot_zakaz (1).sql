-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Хост: localhost
-- Время создания: Июн 13 2025 г., 18:30
-- Версия сервера: 10.5.29-MariaDB-0+deb11u1
-- Версия PHP: 8.2.28

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- База данных: `bot_zakaz`
--

-- --------------------------------------------------------

--
-- Структура таблицы `admins`
--

CREATE TABLE `admins` (
  `id` int(11) NOT NULL,
  `telegram_id` bigint(20) NOT NULL,
  `username` varchar(255) DEFAULT NULL,
  `first_name` varchar(255) DEFAULT NULL,
  `last_name` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Дамп данных таблицы `admins`
--

INSERT INTO `admins` (`id`, `telegram_id`, `username`, `first_name`, `last_name`, `is_active`, `created_at`) VALUES
(1, 906436062, 'vertusoff', 'pikamonov\r\n', NULL, 1, '2025-06-09 20:16:31');

-- --------------------------------------------------------

--
-- Структура таблицы `agents`
--

CREATE TABLE `agents` (
  `user_id` int(11) NOT NULL,
  `agent_access` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `Companies`
--

CREATE TABLE `Companies` (
  `id` int(11) DEFAULT NULL,
  `name` varchar(50) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `email` varchar(50) DEFAULT NULL,
  `phone` varchar(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `conference`
--

CREATE TABLE `conference` (
  `conference_id` int(11) NOT NULL,
  `games` int(11) DEFAULT 0,
  `kick_leave` int(11) DEFAULT 0,
  `rules` text DEFAULT NULL,
  `public` text DEFAULT NULL,
  `uniquekey` text DEFAULT NULL,
  `hello_text` text DEFAULT NULL,
  `stickers` int(11) NOT NULL DEFAULT 0,
  `docs` int(11) NOT NULL DEFAULT 0,
  `reposts` int(11) NOT NULL DEFAULT 0,
  `links` int(11) NOT NULL DEFAULT 0,
  `images` int(11) NOT NULL DEFAULT 0,
  `groups` int(11) NOT NULL DEFAULT 0,
  `video` int(11) NOT NULL DEFAULT 0,
  `cooldown` int(11) NOT NULL DEFAULT 0,
  `spam` int(11) NOT NULL DEFAULT 1,
  `system_notifications_enabled` tinyint(1) DEFAULT 1,
  `notifications` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

--
-- Дамп данных таблицы `conference`
--

INSERT INTO `conference` (`conference_id`, `games`, `kick_leave`, `rules`, `public`, `uniquekey`, `hello_text`, `stickers`, `docs`, `reposts`, `links`, `images`, `groups`, `video`, `cooldown`, `spam`, `system_notifications_enabled`, `notifications`) VALUES
(549678497, 0, 0, NULL, NULL, 'bwlmr', NULL, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0),
(2000000003, 0, 0, NULL, NULL, 'mgpp7', NULL, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0),
(2000000004, 0, 0, NULL, NULL, 's4oin', NULL, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0);

-- --------------------------------------------------------

--
-- Структура таблицы `conference_549678497`
--

CREATE TABLE `conference_549678497` (
  `user_id` int(11) NOT NULL,
  `messages_count` int(11) DEFAULT NULL,
  `coins` int(11) DEFAULT NULL,
  `blocked_users` text DEFAULT NULL,
  `warns` int(11) DEFAULT NULL,
  `warns_history` text DEFAULT NULL,
  `vigs` int(11) DEFAULT NULL,
  `vigs_history` text DEFAULT NULL,
  `chat_block` tinyint(1) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Дамп данных таблицы `conference_549678497`
--

INSERT INTO `conference_549678497` (`user_id`, `messages_count`, `coins`, `blocked_users`, `warns`, `warns_history`, `vigs`, `vigs_history`, `chat_block`) VALUES
(549678497, 1, 1, NULL, NULL, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Структура таблицы `conference_2000000003`
--

CREATE TABLE `conference_2000000003` (
  `user_id` int(11) NOT NULL,
  `messages_count` int(11) DEFAULT NULL,
  `coins` int(11) DEFAULT NULL,
  `blocked_users` text DEFAULT NULL,
  `warns` int(11) DEFAULT NULL,
  `warns_history` text DEFAULT NULL,
  `chat_block` tinyint(1) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Дамп данных таблицы `conference_2000000003`
--

INSERT INTO `conference_2000000003` (`user_id`, `messages_count`, `coins`, `blocked_users`, `warns`, `warns_history`, `chat_block`) VALUES
(357679890, NULL, NULL, NULL, NULL, NULL, NULL),
(549678497, 92, 1, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Структура таблицы `conference_2000000004`
--

CREATE TABLE `conference_2000000004` (
  `user_id` int(11) NOT NULL,
  `messages_count` int(11) DEFAULT NULL,
  `coins` int(11) DEFAULT NULL,
  `blocked_users` text DEFAULT NULL,
  `warns` int(11) DEFAULT NULL,
  `warns_history` text DEFAULT NULL,
  `chat_block` tinyint(1) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Дамп данных таблицы `conference_2000000004`
--

INSERT INTO `conference_2000000004` (`user_id`, `messages_count`, `coins`, `blocked_users`, `warns`, `warns_history`, `chat_block`) VALUES
(357679890, NULL, NULL, '[]', NULL, NULL, NULL),
(549678497, 15, 1, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Структура таблицы `custom_roles_20`
--

CREATE TABLE `custom_roles_20` (
  `role_id` int(11) NOT NULL,
  `role_name` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Дамп данных таблицы `custom_roles_20`
--

INSERT INTO `custom_roles_20` (`role_id`, `role_name`) VALUES
(0, 'Участник'),
(20, 'Модератор'),
(40, 'Администратор'),
(60, 'Спец. Администратор'),
(80, 'Руководитель'),
(100, 'Владелец');

-- --------------------------------------------------------

--
-- Структура таблицы `custom_roles_549678497`
--

CREATE TABLE `custom_roles_549678497` (
  `role_id` int(11) NOT NULL,
  `role_name` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Дамп данных таблицы `custom_roles_549678497`
--

INSERT INTO `custom_roles_549678497` (`role_id`, `role_name`) VALUES
(0, 'Участник'),
(20, 'Модератор'),
(40, 'Администратор'),
(60, 'Спец. Администратор'),
(80, 'Руководитель'),
(100, 'Владелец');

-- --------------------------------------------------------

--
-- Структура таблицы `custom_roles_2000000003`
--

CREATE TABLE `custom_roles_2000000003` (
  `role_id` int(11) NOT NULL,
  `role_name` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Дамп данных таблицы `custom_roles_2000000003`
--

INSERT INTO `custom_roles_2000000003` (`role_id`, `role_name`) VALUES
(0, 'Участник'),
(20, 'пиздализ'),
(40, 'Администратор'),
(60, 'Спец. Администратор'),
(80, 'Руководитель'),
(100, 'тест');

-- --------------------------------------------------------

--
-- Структура таблицы `custom_roles_2000000004`
--

CREATE TABLE `custom_roles_2000000004` (
  `role_id` int(11) NOT NULL,
  `role_name` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Дамп данных таблицы `custom_roles_2000000004`
--

INSERT INTO `custom_roles_2000000004` (`role_id`, `role_name`) VALUES
(0, 'Участник'),
(20, 'пиздализ'),
(40, 'Администратор'),
(60, 'Спец. Администратор'),
(80, 'Руководитель'),
(100, 'Владелец');

-- --------------------------------------------------------

--
-- Структура таблицы `nicknames_549678497`
--

CREATE TABLE `nicknames_549678497` (
  `user_id` int(11) NOT NULL,
  `nickname` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `nicknames_2000000003`
--

CREATE TABLE `nicknames_2000000003` (
  `user_id` int(11) NOT NULL,
  `nickname` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `nicknames_2000000004`
--

CREATE TABLE `nicknames_2000000004` (
  `user_id` int(11) NOT NULL,
  `nickname` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `pools`
--

CREATE TABLE `pools` (
  `id` int(11) NOT NULL,
  `pool_name` varchar(255) NOT NULL,
  `pool_key` varchar(255) NOT NULL,
  `pool_peerIds` text NOT NULL,
  `creator_id` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

--
-- Дамп данных таблицы `pools`
--

INSERT INTO `pools` (`id`, `pool_name`, `pool_key`, `pool_peerIds`, `creator_id`, `created_at`) VALUES
(13, '1', 'bd26d79b90', '[2000000003,2000000004]', 549678497, '2025-06-07 00:34:22');

-- --------------------------------------------------------

--
-- Структура таблицы `roles_549678497`
--

CREATE TABLE `roles_549678497` (
  `user_id` int(11) NOT NULL,
  `role_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Дамп данных таблицы `roles_549678497`
--

INSERT INTO `roles_549678497` (`user_id`, `role_id`) VALUES
(549678497, 100);

-- --------------------------------------------------------

--
-- Структура таблицы `roles_2000000003`
--

CREATE TABLE `roles_2000000003` (
  `user_id` int(11) NOT NULL,
  `role_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Дамп данных таблицы `roles_2000000003`
--

INSERT INTO `roles_2000000003` (`user_id`, `role_id`) VALUES
(549678497, 100);

-- --------------------------------------------------------

--
-- Структура таблицы `roles_2000000004`
--

CREATE TABLE `roles_2000000004` (
  `user_id` int(11) NOT NULL,
  `role_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Дамп данных таблицы `roles_2000000004`
--

INSERT INTO `roles_2000000004` (`user_id`, `role_id`) VALUES
(549678497, 100);

-- --------------------------------------------------------

--
-- Структура таблицы `servers`
--

CREATE TABLE `servers` (
  `server_ip` varchar(64) DEFAULT NULL,
  `server_port` varchar(64) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `support_messages`
--

CREATE TABLE `support_messages` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `telegram_id` bigint(20) NOT NULL,
  `message` text NOT NULL,
  `status` varchar(50) DEFAULT 'new',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Дамп данных таблицы `support_messages`
--

INSERT INTO `support_messages` (`id`, `user_id`, `telegram_id`, `message`, `status`, `created_at`) VALUES
(1, 1, 5861899045, 'привет', 'answered', '2025-06-09 20:32:06'),
(2, 1, 5861899045, 'привет', 'resolved', '2025-06-09 20:40:58'),
(3, 2, 906436062, '123', 'answered', '2025-06-10 15:35:45'),
(4, 4, 5879701453, 'вы пидоры', 'answered', '2025-06-10 17:35:05'),
(5, 3, 1076047869, 'здравствуйте, установите пожалуйста на мою vds, lamp сервер и разверните базу данных', 'answered', '2025-06-13 06:39:22');

-- --------------------------------------------------------

--
-- Структура таблицы `support_replies`
--

CREATE TABLE `support_replies` (
  `id` int(11) NOT NULL,
  `message_id` int(11) NOT NULL,
  `admin_id` bigint(20) NOT NULL,
  `reply_text` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Дамп данных таблицы `support_replies`
--

INSERT INTO `support_replies` (`id`, `message_id`, `admin_id`, `reply_text`, `created_at`) VALUES
(1, 1, 906436062, 'сосал', '2025-06-09 20:41:52'),
(2, 3, 906436062, 'я ебал меня сосали', '2025-06-10 15:36:08'),
(3, 4, 906436062, 'долбоеб, ты у нас работаешь', '2025-06-10 17:39:25'),
(4, 5, 906436062, 'Здравствуйте, установили LAMP и базу данных.\n\nБаза данных;\nhttp://89.208.32.234/phpmyadmin/\nимя: admin\nпароль: 0wpCmWF4b6K9O\n\nвеб сервер;\napache2 \nPHP 8.2 + 7.4. \n\nСпасибо, за выбор нашего сервиса.', '2025-06-13 07:13:42');

-- --------------------------------------------------------

--
-- Структура таблицы `sysadmins`
--

CREATE TABLE `sysadmins` (
  `userid` int(11) NOT NULL,
  `access` int(11) NOT NULL
) ;

--
-- Дамп данных таблицы `sysadmins`
--

INSERT INTO `sysadmins` (`userid`, `access`) VALUES
(549678497, 4);

-- --------------------------------------------------------

--
-- Структура таблицы `sysbanned`
--

CREATE TABLE `sysbanned` (
  `userid` int(11) NOT NULL,
  `time` bigint(20) NOT NULL,
  `reason` varchar(255) DEFAULT 'Не указана',
  `who` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Дамп данных таблицы `sysbanned`
--

INSERT INTO `sysbanned` (`userid`, `time`, `reason`, `who`) VALUES
(357679890, 1749781306, 'сосала', 549678497);

-- --------------------------------------------------------

--
-- Структура таблицы `testers`
--

CREATE TABLE `testers` (
  `id` int(11) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `tester_access` tinyint(4) NOT NULL DEFAULT 1,
  `assigned_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `tickets`
--

CREATE TABLE `tickets` (
  `id` int(11) NOT NULL,
  `userid` int(11) NOT NULL,
  `mess` text NOT NULL,
  `status` tinyint(1) DEFAULT 0,
  `peer_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Дамп данных таблицы `tickets`
--

INSERT INTO `tickets` (`id`, `userid`, `mess`, `status`, `peer_id`, `created_at`) VALUES
(1, 549678497, '123', 1, 2000000003, '2025-06-13 02:34:50'),
(2, 549678497, '123123', 1, 2000000003, '2025-06-13 02:39:41'),
(3, 549678497, 'я сосал меня ебали', 0, 2000000003, '2025-06-13 02:40:20');

-- --------------------------------------------------------

--
-- Структура таблицы `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `telegram_id` bigint(20) NOT NULL,
  `username` varchar(255) DEFAULT NULL,
  `first_name` varchar(255) DEFAULT NULL,
  `last_name` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Дамп данных таблицы `users`
--

INSERT INTO `users` (`id`, `telegram_id`, `username`, `first_name`, `last_name`, `is_active`, `created_at`) VALUES
(1, 5861899045, 'cloudnetwork_support', 'velmorov | CloudNetwork', NULL, 1, '2025-06-09 20:15:25'),
(2, 906436062, 'vertusoff', 'pikamonov', NULL, 1, '2025-06-09 20:15:45'),
(3, 1076047869, NULL, NULL, NULL, 1, '2025-06-09 21:00:06'),
(4, 5879701453, 'internetsblock', 'komaru | idle-coding.ru', NULL, 1, '2025-06-10 17:34:53');

-- --------------------------------------------------------

--
-- Структура таблицы `vds_purchase_info`
--

CREATE TABLE `vds_purchase_info` (
  `id` int(11) NOT NULL,
  `vps_id` int(11) NOT NULL,
  `purchase_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `period` int(11) NOT NULL,
  `expiry_date` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `notification_7days_sent` tinyint(1) DEFAULT 0,
  `notification_1day_sent` tinyint(1) DEFAULT 0,
  `notification_expired_sent` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Дамп данных таблицы `vds_purchase_info`
--

INSERT INTO `vds_purchase_info` (`id`, `vps_id`, `purchase_date`, `period`, `expiry_date`, `notification_7days_sent`, `notification_1day_sent`, `notification_expired_sent`) VALUES
(1, 10000, '2025-05-09 21:00:00', 1, '2025-05-10 21:00:00', 0, 0, 0),
(2, 10001, '2025-06-09 21:00:00', 30, '2025-07-09 21:00:00', 0, 0, 0),
(3, 10002, '2025-05-31 21:00:00', 30, '2025-06-30 21:00:00', 0, 0, 0),
(4, 10003, '2025-06-12 21:00:00', 30, '2025-07-12 21:00:00', 0, 0, 0);

-- --------------------------------------------------------

--
-- Структура таблицы `vds_servers`
--

CREATE TABLE `vds_servers` (
  `id` int(11) NOT NULL,
  `vps_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `vps_name` varchar(255) DEFAULT NULL,
  `vps_ip` varchar(255) DEFAULT NULL,
  `vps_port` int(11) DEFAULT 22,
  `vps_username` varchar(255) DEFAULT NULL,
  `vps_password` varchar(255) DEFAULT NULL,
  `os_type` varchar(255) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'active',
  `is_blocked` tinyint(1) DEFAULT 0,
  `purchase_date` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `assigned_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `api_vps_id` int(11) DEFAULT NULL,
  `order_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Дамп данных таблицы `vds_servers`
--

INSERT INTO `vds_servers` (`id`, `vps_id`, `user_id`, `vps_name`, `vps_ip`, `vps_port`, `vps_username`, `vps_password`, `os_type`, `status`, `is_blocked`, `purchase_date`, `assigned_date`, `api_vps_id`, `order_id`) VALUES
(3, 10001, 1, 'VDS-192', '212.15.49.75', 22, 'root', 'MWPG2sR7AtpAA', 'debian_11', 'active', 0, '2025-06-09 21:00:00', '2025-06-10 15:37:13', 34918, 55828),
(4, 10002, 3, 'VDS-06', '89.208.32.130', 9714, 'root', 'qyr9Hjyc8jykE', 'debian_11', 'active', 0, '2025-05-31 21:00:00', '2025-06-10 16:01:47', 25419, 41000),
(5, 10003, 2, 'vds-test', '147.45.219.119', 22, 'root', 'nRhkcZD4HTmT3', 'debian_11', 'active', 0, '2025-06-12 21:00:00', '2025-06-13 05:13:38', 33766, 54001);

-- --------------------------------------------------------

--
-- Структура таблицы `vip_users`
--

CREATE TABLE `vip_users` (
  `user_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

--
-- Индексы сохранённых таблиц
--

--
-- Индексы таблицы `admins`
--
ALTER TABLE `admins`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `telegram_id` (`telegram_id`);

--
-- Индексы таблицы `agents`
--
ALTER TABLE `agents`
  ADD UNIQUE KEY `user_id` (`user_id`),
  ADD KEY `agent_access` (`agent_access`);

--
-- Индексы таблицы `conference`
--
ALTER TABLE `conference`
  ADD PRIMARY KEY (`conference_id`);

--
-- Индексы таблицы `conference_549678497`
--
ALTER TABLE `conference_549678497`
  ADD PRIMARY KEY (`user_id`);

--
-- Индексы таблицы `conference_2000000003`
--
ALTER TABLE `conference_2000000003`
  ADD PRIMARY KEY (`user_id`);

--
-- Индексы таблицы `conference_2000000004`
--
ALTER TABLE `conference_2000000004`
  ADD PRIMARY KEY (`user_id`);

--
-- Индексы таблицы `custom_roles_20`
--
ALTER TABLE `custom_roles_20`
  ADD PRIMARY KEY (`role_id`);

--
-- Индексы таблицы `custom_roles_549678497`
--
ALTER TABLE `custom_roles_549678497`
  ADD PRIMARY KEY (`role_id`);

--
-- Индексы таблицы `custom_roles_2000000003`
--
ALTER TABLE `custom_roles_2000000003`
  ADD PRIMARY KEY (`role_id`);

--
-- Индексы таблицы `custom_roles_2000000004`
--
ALTER TABLE `custom_roles_2000000004`
  ADD PRIMARY KEY (`role_id`);

--
-- Индексы таблицы `nicknames_549678497`
--
ALTER TABLE `nicknames_549678497`
  ADD PRIMARY KEY (`user_id`);

--
-- Индексы таблицы `nicknames_2000000003`
--
ALTER TABLE `nicknames_2000000003`
  ADD PRIMARY KEY (`user_id`);

--
-- Индексы таблицы `nicknames_2000000004`
--
ALTER TABLE `nicknames_2000000004`
  ADD PRIMARY KEY (`user_id`);

--
-- Индексы таблицы `pools`
--
ALTER TABLE `pools`
  ADD PRIMARY KEY (`id`);

--
-- Индексы таблицы `roles_549678497`
--
ALTER TABLE `roles_549678497`
  ADD PRIMARY KEY (`user_id`);

--
-- Индексы таблицы `roles_2000000003`
--
ALTER TABLE `roles_2000000003`
  ADD PRIMARY KEY (`user_id`);

--
-- Индексы таблицы `roles_2000000004`
--
ALTER TABLE `roles_2000000004`
  ADD PRIMARY KEY (`user_id`);

--
-- Индексы таблицы `servers`
--
ALTER TABLE `servers`
  ADD UNIQUE KEY `server_ip` (`server_ip`),
  ADD KEY `server_port` (`server_port`) USING BTREE;

--
-- Индексы таблицы `support_messages`
--
ALTER TABLE `support_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Индексы таблицы `support_replies`
--
ALTER TABLE `support_replies`
  ADD PRIMARY KEY (`id`),
  ADD KEY `message_id` (`message_id`);

--
-- Индексы таблицы `sysadmins`
--
ALTER TABLE `sysadmins`
  ADD PRIMARY KEY (`userid`);

--
-- Индексы таблицы `sysbanned`
--
ALTER TABLE `sysbanned`
  ADD PRIMARY KEY (`userid`);

--
-- Индексы таблицы `testers`
--
ALTER TABLE `testers`
  ADD PRIMARY KEY (`id`);

--
-- Индексы таблицы `tickets`
--
ALTER TABLE `tickets`
  ADD PRIMARY KEY (`id`);

--
-- Индексы таблицы `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `telegram_id` (`telegram_id`);

--
-- Индексы таблицы `vds_purchase_info`
--
ALTER TABLE `vds_purchase_info`
  ADD PRIMARY KEY (`id`),
  ADD KEY `vps_id` (`vps_id`);

--
-- Индексы таблицы `vds_servers`
--
ALTER TABLE `vds_servers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `vds_servers_ibfk_1` (`user_id`);

--
-- Индексы таблицы `vip_users`
--
ALTER TABLE `vip_users`
  ADD UNIQUE KEY `user_id` (`user_id`);

--
-- AUTO_INCREMENT для сохранённых таблиц
--

--
-- AUTO_INCREMENT для таблицы `admins`
--
ALTER TABLE `admins`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT для таблицы `pools`
--
ALTER TABLE `pools`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT для таблицы `support_messages`
--
ALTER TABLE `support_messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT для таблицы `support_replies`
--
ALTER TABLE `support_replies`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT для таблицы `testers`
--
ALTER TABLE `testers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT для таблицы `tickets`
--
ALTER TABLE `tickets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT для таблицы `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT для таблицы `vds_purchase_info`
--
ALTER TABLE `vds_purchase_info`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT для таблицы `vds_servers`
--
ALTER TABLE `vds_servers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- Ограничения внешнего ключа сохраненных таблиц
--

--
-- Ограничения внешнего ключа таблицы `support_messages`
--
ALTER TABLE `support_messages`
  ADD CONSTRAINT `support_messages_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
